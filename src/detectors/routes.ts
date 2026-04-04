import { relative, basename } from "node:path";
import { readFileSafe } from "../scanner.js";
import type { RouteInfo, Framework, ProjectInfo } from "../types.js";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

const TAG_PATTERNS: [string, RegExp[]][] = [
  ["auth", [/auth/i, /jwt/i, /token/i, /session/i, /bearer/i, /passport/i, /clerk/i, /betterAuth/i, /better-auth/i]],
  ["db", [/prisma/i, /drizzle/i, /typeorm/i, /sequelize/i, /mongoose/i, /knex/i, /sql/i, /\.query\(/i, /\.execute\(/i, /\.findMany\(/i, /\.findFirst\(/i, /\.insert\(/i, /\.update\(/i, /\.delete\(/i]],
  ["cache", [/redis/i, /cache/i, /memcache/i, /\.setex\(/i, /\.getex\(/i]],
  ["queue", [/bullmq/i, /bull\b/i, /\.add\(\s*['"`]/i, /queue/i]],
  ["email", [/resend/i, /sendgrid/i, /nodemailer/i, /\.send\(\s*\{[\s\S]*?to:/i]],
  ["payment", [/stripe/i, /polar/i, /paddle/i, /lemon/i, /checkout/i, /webhook/i]],
  ["upload", [/multer/i, /formidable/i, /busboy/i, /upload/i, /multipart/i]],
  ["ai", [/openai/i, /anthropic/i, /claude/i, /\.chat\.completions/i, /\.messages\.create/i]],
];

function detectTags(content: string): string[] {
  const tags: string[] = [];
  for (const [tag, patterns] of TAG_PATTERNS) {
    if (patterns.some((p) => p.test(content))) {
      tags.push(tag);
    }
  }
  return tags;
}

export async function detectRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];

  for (const fw of project.frameworks) {
    switch (fw) {
      case "next-app":
        routes.push(...(await detectNextAppRoutes(files, project)));
        break;
      case "next-pages":
        routes.push(...(await detectNextPagesApi(files, project)));
        break;
      case "hono":
        routes.push(...(await detectHonoRoutes(files, project)));
        break;
      case "express":
        routes.push(...(await detectExpressRoutes(files, project)));
        break;
      case "fastify":
        routes.push(...(await detectFastifyRoutes(files, project)));
        break;
      case "koa":
        routes.push(...(await detectKoaRoutes(files, project)));
        break;
      case "nestjs":
        routes.push(...(await detectNestJSRoutes(files, project)));
        break;
      case "elysia":
        routes.push(...(await detectElysiaRoutes(files, project)));
        break;
      case "adonis":
        routes.push(...(await detectAdonisRoutes(files, project)));
        break;
      case "trpc":
        routes.push(...(await detectTRPCRoutes(files, project)));
        break;
      case "sveltekit":
        routes.push(...(await detectSvelteKitRoutes(files, project)));
        break;
      case "remix":
        routes.push(...(await detectRemixRoutes(files, project)));
        break;
      case "nuxt":
        routes.push(...(await detectNuxtRoutes(files, project)));
        break;
      case "fastapi":
        routes.push(...(await detectFastAPIRoutes(files, project)));
        break;
      case "flask":
        routes.push(...(await detectFlaskRoutes(files, project)));
        break;
      case "django":
        routes.push(...(await detectDjangoRoutes(files, project)));
        break;
      case "gin":
      case "go-net-http":
      case "fiber":
      case "echo":
      case "chi":
        routes.push(...(await detectGoRoutes(files, project, fw)));
        break;
      case "rails":
        routes.push(...(await detectRailsRoutes(files, project)));
        break;
      case "phoenix":
        routes.push(...(await detectPhoenixRoutes(files, project)));
        break;
      case "spring":
        routes.push(...(await detectSpringRoutes(files, project)));
        break;
      case "actix":
      case "axum":
        routes.push(...(await detectRustRoutes(files, project, fw)));
        break;
      case "raw-http":
        routes.push(...(await detectRawHttpRoutes(files, project)));
        break;
    }
  }

  return routes;
}

// --- Next.js App Router ---
async function detectNextAppRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const routeFiles = files.filter(
    (f) => f.match(/\/app\/.*\/route\.(ts|js|tsx|jsx)$/) || f.match(/\/app\/route\.(ts|js|tsx|jsx)$/)
  );
  const routes: RouteInfo[] = [];

  for (const file of routeFiles) {
    const content = await readFileSafe(file);
    const rel = relative(project.root, file);
    const pathMatch = rel.match(/(?:src\/)?app(.*)\/route\./);
    const apiPath = pathMatch ? pathMatch[1] || "/" : "/";

    for (const method of HTTP_METHODS) {
      const pattern = new RegExp(
        `export\\s+(?:async\\s+)?function\\s+${method}\\b`
      );
      if (pattern.test(content)) {
        routes.push({
          method,
          path: apiPath,
          file: rel,
          tags: detectTags(content),
          framework: "next-app",
        });
      }
    }
  }

  return routes;
}

// --- Next.js Pages API ---
async function detectNextPagesApi(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const apiFiles = files.filter((f) =>
    f.match(/\/pages\/api\/.*\.(ts|js|tsx|jsx)$/)
  );
  const routes: RouteInfo[] = [];

  for (const file of apiFiles) {
    const content = await readFileSafe(file);
    const rel = relative(project.root, file);
    const pathMatch = rel.match(/(?:src\/)?pages(\/api\/.*)\.(?:ts|js|tsx|jsx)$/);
    let apiPath = pathMatch ? pathMatch[1] : "/api";
    apiPath = apiPath.replace(/\/index$/, "").replace(/\[([^\]]+)\]/g, ":$1");

    const methods: string[] = [];
    for (const method of HTTP_METHODS) {
      if (content.includes(`req.method === '${method}'`) || content.includes(`req.method === "${method}"`)) {
        methods.push(method);
      }
    }
    if (methods.length === 0) methods.push("ALL");

    for (const method of methods) {
      routes.push({
        method,
        path: apiPath,
        file: rel,
        tags: detectTags(content),
        framework: "next-pages",
      });
    }
  }

  return routes;
}

// --- Hono ---
async function detectHonoRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const tsFiles = files.filter((f) => f.match(/\.(ts|js|tsx|jsx|mjs)$/));
  const routes: RouteInfo[] = [];

  for (const file of tsFiles) {
    const content = await readFileSafe(file);
    if (!content.includes("hono") && !content.includes("Hono")) continue;

    const rel = relative(project.root, file);
    const routePattern =
      /\.\s*(get|post|put|patch|delete|options|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      const path = match[2];
      if (!path.startsWith("/") && !path.startsWith(":")) continue;
      routes.push({
        method: match[1].toUpperCase(),
        path,
        file: rel,
        tags: detectTags(content),
        framework: "hono",
      });
    }
  }

  return routes;
}

// --- Express ---
async function detectExpressRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const tsFiles = files.filter((f) => f.match(/\.(ts|js|mjs|cjs)$/));
  const routes: RouteInfo[] = [];

  for (const file of tsFiles) {
    const content = await readFileSafe(file);
    if (!content.includes("express") && !content.includes("Router")) continue;

    const rel = relative(project.root, file);
    const routePattern =
      /(?:app|router|server)\s*\.\s*(get|post|put|patch|delete|options|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: rel,
        tags: detectTags(content),
        framework: "express",
      });
    }
  }

  return routes;
}

// --- Fastify ---
async function detectFastifyRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const tsFiles = files.filter((f) => f.match(/\.(ts|js|mjs|cjs)$/));
  const routes: RouteInfo[] = [];

  for (const file of tsFiles) {
    const content = await readFileSafe(file);
    if (!content.includes("fastify")) continue;

    const rel = relative(project.root, file);
    const routePattern =
      /(?:fastify|server|app)\s*\.\s*(get|post|put|patch|delete|options|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: rel,
        tags: detectTags(content),
        framework: "fastify",
      });
    }

    // Object-style route registration
    const objPattern =
      /\.route\s*\(\s*\{[\s\S]*?method:\s*['"`](\w+)['"`][\s\S]*?url:\s*['"`]([^'"`]+)['"`]/gi;
    while ((match = objPattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: rel,
        tags: detectTags(content),
        framework: "fastify",
      });
    }
  }

  return routes;
}

// --- Koa ---
async function detectKoaRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const tsFiles = files.filter((f) => f.match(/\.(ts|js|mjs|cjs)$/));
  const routes: RouteInfo[] = [];

  for (const file of tsFiles) {
    const content = await readFileSafe(file);
    if (!content.includes("koa") && !content.includes("Router")) continue;

    const rel = relative(project.root, file);
    const routePattern =
      /router\s*\.\s*(get|post|put|patch|delete|options|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: rel,
        tags: detectTags(content),
        framework: "koa",
      });
    }
  }

  return routes;
}

// --- NestJS ---
async function detectNestJSRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const tsFiles = files.filter((f) => f.match(/\.(ts|js)$/));
  const routes: RouteInfo[] = [];

  for (const file of tsFiles) {
    const content = await readFileSafe(file);
    if (!content.includes("@Controller") && !content.includes("@Get") && !content.includes("@Post")) continue;

    const rel = relative(project.root, file);

    // Extract controller base path: @Controller('users') or @Controller('/users')
    const controllerMatch = content.match(/@Controller\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/);
    const basePath = controllerMatch ? "/" + controllerMatch[1].replace(/^\//, "") : "";

    // Match method decorators: @Get(), @Post('/create'), @Put(':id'), etc.
    const decoratorPattern = /@(Get|Post|Put|Patch|Delete|Options|Head|All)\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/gi;
    let match;
    while ((match = decoratorPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const subPath = match[2] || "";
      const fullPath = basePath + (subPath ? "/" + subPath.replace(/^\//, "") : "") || "/";
      routes.push({
        method,
        path: fullPath,
        file: rel,
        tags: detectTags(content),
        framework: "nestjs",
      });
    }
  }

  return routes;
}

// --- Elysia (Bun) ---
async function detectElysiaRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const tsFiles = files.filter((f) => f.match(/\.(ts|js|mjs)$/));
  const routes: RouteInfo[] = [];

  for (const file of tsFiles) {
    const content = await readFileSafe(file);
    if (!content.includes("elysia") && !content.includes("Elysia")) continue;

    const rel = relative(project.root, file);
    const routePattern = /\.\s*(get|post|put|patch|delete|options|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      const path = match[2];
      if (!path.startsWith("/") && !path.startsWith(":")) continue;
      routes.push({
        method: match[1].toUpperCase(),
        path,
        file: rel,
        tags: detectTags(content),
        framework: "elysia",
      });
    }
  }

  return routes;
}

// --- AdonisJS ---
async function detectAdonisRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  // AdonisJS uses start/routes.ts with Route.get(), Route.post(), router.get(), etc.
  const routeFiles = files.filter(
    (f) => f.match(/routes\.(ts|js)$/) || f.match(/\/routes\/.*\.(ts|js)$/)
  );
  const routes: RouteInfo[] = [];

  for (const file of routeFiles) {
    const content = await readFileSafe(file);
    const rel = relative(project.root, file);

    const routePattern = /(?:Route|router)\s*\.\s*(get|post|put|patch|delete|any)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase() === "ANY" ? "ALL" : match[1].toUpperCase(),
        path: match[2],
        file: rel,
        tags: detectTags(content),
        framework: "adonis",
      });
    }
  }

  return routes;
}

// --- tRPC ---
async function detectTRPCRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const tsFiles = files.filter((f) => f.match(/\.(ts|js)$/));
  const routes: RouteInfo[] = [];

  for (const file of tsFiles) {
    const content = await readFileSafe(file);
    if (!content.includes("Procedure") && !content.includes("procedure") && !content.includes("router")) continue;
    if (!content.includes("trpc") && !content.includes("TRPC") && !content.includes("createTRPCRouter") && !content.includes("publicProcedure") && !content.includes("protectedProcedure")) continue;

    const rel = relative(project.root, file);

    // Match tRPC procedure definitions like:
    //   list: publicProcedure.query(...)
    //   create: publicProcedure.input(schema).mutation(...)
    //   getById: t.procedure.input(z.object({...})).query(...)
    // Strategy: find lines with "query(" or "mutation(" and extract the procedure name
    const lines = content.split("\n");
    for (const line of lines) {
      const queryMatch = line.match(/^\s*(\w+)\s*:\s*.*\.(query)\s*\(/);
      const mutationMatch = line.match(/^\s*(\w+)\s*:\s*.*\.(mutation)\s*\(/);
      const m = queryMatch || mutationMatch;
      if (m) {
        const procName = m[1];
        const isQuery = m[2] === "query";
        if (!routes.some((r) => r.path === procName && r.file === rel)) {
          routes.push({
            method: isQuery ? "QUERY" : "MUTATION",
            path: procName,
            file: rel,
            tags: detectTags(content),
            framework: "trpc",
          });
        }
      }
    }
  }

  return routes;
}

// --- SvelteKit ---
async function detectSvelteKitRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  // SvelteKit API routes: src/routes/**/+server.ts
  const routeFiles = files.filter(
    (f) => f.match(/\/routes\/.*\+server\.(ts|js)$/)
  );
  const routes: RouteInfo[] = [];

  for (const file of routeFiles) {
    const content = await readFileSafe(file);
    const rel = relative(project.root, file);

    // Extract path from file structure: src/routes/api/users/+server.ts -> /api/users
    const pathMatch = rel.match(/(?:src\/)?routes(.*)\/\+server\./);
    let apiPath = pathMatch ? pathMatch[1] || "/" : "/";
    // Convert [param] to :param
    apiPath = apiPath.replace(/\[([^\]]+)\]/g, ":$1");

    for (const method of HTTP_METHODS) {
      const pattern = new RegExp(
        `export\\s+(?:async\\s+)?function\\s+${method}\\b`
      );
      if (pattern.test(content)) {
        routes.push({
          method,
          path: apiPath,
          file: rel,
          tags: detectTags(content),
          framework: "sveltekit",
        });
      }
    }

    // Also detect: export const GET = ...
    for (const method of HTTP_METHODS) {
      const constPattern = new RegExp(`export\\s+const\\s+${method}\\s*[=:]`);
      if (constPattern.test(content) && !routes.some((r) => r.method === method && r.path === apiPath)) {
        routes.push({
          method,
          path: apiPath,
          file: rel,
          tags: detectTags(content),
          framework: "sveltekit",
        });
      }
    }
  }

  return routes;
}

// --- Remix ---
async function detectRemixRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  // Remix routes: app/routes/*.tsx with loader/action exports
  const routeFiles = files.filter(
    (f) => f.match(/\/routes\/.*\.(ts|tsx|js|jsx)$/)
  );
  const routes: RouteInfo[] = [];

  for (const file of routeFiles) {
    const content = await readFileSafe(file);
    const rel = relative(project.root, file);

    // Convert filename to route path
    const pathMatch = rel.match(/(?:app\/)?routes\/(.+)\.(ts|tsx|js|jsx)$/);
    if (!pathMatch) continue;
    let routePath = "/" + pathMatch[1]
      .replace(/\./g, "/")       // dots become path segments
      .replace(/_index$/, "")    // _index -> root of parent
      .replace(/\$/g, ":")       // $param -> :param
      .replace(/\[([^\]]+)\]/g, ":$1");

    if (content.match(/export\s+(?:async\s+)?function\s+loader\b/) || content.match(/export\s+const\s+loader\b/)) {
      routes.push({
        method: "GET",
        path: routePath,
        file: rel,
        tags: detectTags(content),
        framework: "remix",
      });
    }
    if (content.match(/export\s+(?:async\s+)?function\s+action\b/) || content.match(/export\s+const\s+action\b/)) {
      routes.push({
        method: "POST",
        path: routePath,
        file: rel,
        tags: detectTags(content),
        framework: "remix",
      });
    }
  }

  return routes;
}

// --- Nuxt ---
async function detectNuxtRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  // Nuxt server routes: server/api/**/*.ts
  const routeFiles = files.filter(
    (f) => f.match(/\/server\/(?:api|routes)\/.*\.(ts|js|mjs)$/)
  );
  const routes: RouteInfo[] = [];

  for (const file of routeFiles) {
    const content = await readFileSafe(file);
    const rel = relative(project.root, file);

    // Extract path from file structure
    const pathMatch = rel.match(/server\/((?:api|routes)\/.+)\.(ts|js|mjs)$/);
    if (!pathMatch) continue;
    let routePath = "/" + pathMatch[1]
      .replace(/\/index$/, "")
      .replace(/\[([^\]]+)\]/g, ":$1");

    // Detect method from filename (e.g., users.get.ts, users.post.ts)
    const methodFromFile = basename(file).match(/\.(get|post|put|patch|delete)\.(ts|js|mjs)$/);
    const method = methodFromFile ? methodFromFile[1].toUpperCase() : "ALL";

    // Clean path: remove method suffix from path
    if (methodFromFile) {
      routePath = routePath.replace(new RegExp(`\\.${methodFromFile[1]}$`), "");
    }

    routes.push({
      method,
      path: routePath,
      file: rel,
      tags: detectTags(content),
      framework: "nuxt",
    });
  }

  return routes;
}

// --- FastAPI ---
async function detectFastAPIRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const pyFiles = files.filter((f) => f.endsWith(".py"));
  const routes: RouteInfo[] = [];

  for (const file of pyFiles) {
    const content = await readFileSafe(file);
    if (!content.includes("fastapi") && !content.includes("FastAPI") && !content.includes("APIRouter")) continue;

    const rel = relative(project.root, file);
    const routePattern =
      /@\w+\s*\.\s*(get|post|put|patch|delete|options)\s*\(\s*['"]([^'"]+)['"]/gi;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: rel,
        tags: detectTags(content),
        framework: "fastapi",
      });
    }
  }

  return routes;
}

// --- Flask ---
async function detectFlaskRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const pyFiles = files.filter((f) => f.endsWith(".py"));
  const routes: RouteInfo[] = [];

  for (const file of pyFiles) {
    const content = await readFileSafe(file);
    if (!content.includes("flask") && !content.includes("Flask") && !content.includes("Blueprint")) continue;

    const rel = relative(project.root, file);
    const routePattern =
      /@(?:app|bp|blueprint|\w+)\s*\.\s*route\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*methods\s*=\s*\[([^\]]+)\])?\s*\)/gi;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      const path = match[1];
      const methods = match[2]
        ? match[2].match(/['"](\w+)['"]/g)?.map((m) => m.replace(/['"]/g, "").toUpperCase()) || ["GET"]
        : ["GET"];

      for (const method of methods) {
        routes.push({
          method,
          path,
          file: rel,
          tags: detectTags(content),
          framework: "flask",
        });
      }
    }
  }

  return routes;
}

// --- Django ---
async function detectDjangoRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const pyFiles = files.filter(
    (f) => f.endsWith(".py") && (basename(f) === "urls.py" || basename(f) === "views.py")
  );
  const routes: RouteInfo[] = [];

  for (const file of pyFiles) {
    const content = await readFileSafe(file);
    const rel = relative(project.root, file);

    // path("api/v1/users/", views.UserView.as_view())
    const pathPattern = /path\s*\(\s*['"]([^'"]*)['"]\s*,/g;
    let match;
    while ((match = pathPattern.exec(content)) !== null) {
      routes.push({
        method: "ALL",
        path: "/" + match[1],
        file: rel,
        tags: detectTags(content),
        framework: "django",
      });
    }
  }

  return routes;
}

// --- Go (net/http, Gin, Fiber, Echo, Chi) ---
async function detectGoRoutes(
  files: string[],
  project: ProjectInfo,
  fw: Framework
): Promise<RouteInfo[]> {
  const goFiles = files.filter((f) => f.endsWith(".go"));
  const routes: RouteInfo[] = [];

  for (const file of goFiles) {
    const content = await readFileSafe(file);
    const rel = relative(project.root, file);

    if (fw === "gin") {
      const pattern = /\.\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(\s*["']([^"']+)["']/g;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        routes.push({
          method: match[1],
          path: match[2],
          file: rel,
          tags: detectTags(content),
          framework: fw,
        });
      }
    } else if (fw === "fiber") {
      const pattern = /\.\s*(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*["']([^"']+)["']/g;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2],
          file: rel,
          tags: detectTags(content),
          framework: fw,
        });
      }
    } else if (fw === "echo") {
      // e.GET("/path", handler) or g.POST("/path", handler)
      const pattern = /\.\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(\s*["']([^"']+)["']/g;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        routes.push({
          method: match[1],
          path: match[2],
          file: rel,
          tags: detectTags(content),
          framework: fw,
        });
      }
    } else if (fw === "chi") {
      // r.Get("/path", handler), r.Post("/path", handler)
      const pattern = /\.\s*(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*["']([^"']+)["']/g;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2],
          file: rel,
          tags: detectTags(content),
          framework: fw,
        });
      }
    } else {
      // net/http: http.HandleFunc("/path", handler) or mux.HandleFunc("/path", handler)
      const pattern = /(?:HandleFunc|Handle)\s*\(\s*["']([^"']+)["']/g;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        routes.push({
          method: "ALL",
          path: match[1],
          file: rel,
          tags: detectTags(content),
          framework: fw,
        });
      }
    }
  }

  return routes;
}

// --- Rails ---
async function detectRailsRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const routeFiles = files.filter((f) => f.match(/routes\.rb$/));
  const routes: RouteInfo[] = [];

  for (const file of routeFiles) {
    const content = await readFileSafe(file);
    const rel = relative(project.root, file);

    // get '/users', to: 'users#index'
    const routePattern = /\b(get|post|put|patch|delete)\s+['"]([^'"]+)['"]/gi;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: rel,
        tags: detectTags(content),
        framework: "rails",
      });
    }

    // resources :users (generates RESTful routes)
    const resourcePattern = /resources?\s+:(\w+)/g;
    while ((match = resourcePattern.exec(content)) !== null) {
      const name = match[1];
      for (const [method, suffix] of [
        ["GET", ""], ["GET", "/:id"], ["POST", ""],
        ["PUT", "/:id"], ["PATCH", "/:id"], ["DELETE", "/:id"],
      ] as const) {
        routes.push({
          method,
          path: `/${name}${suffix}`,
          file: rel,
          tags: detectTags(content),
          framework: "rails",
        });
      }
    }
  }

  return routes;
}

// --- Phoenix (Elixir) ---
async function detectPhoenixRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const routeFiles = files.filter((f) => f.match(/router\.ex$/));
  const routes: RouteInfo[] = [];

  for (const file of routeFiles) {
    const content = await readFileSafe(file);
    const rel = relative(project.root, file);

    // get "/users", UserController, :index
    const routePattern = /\b(get|post|put|patch|delete)\s+["']([^"']+)["']/gi;
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: rel,
        tags: detectTags(content),
        framework: "phoenix",
      });
    }

    // resources "/users", UserController
    const resourcePattern = /resources\s+["']([^"']+)["']/g;
    while ((match = resourcePattern.exec(content)) !== null) {
      const basePath = match[1];
      for (const [method, suffix] of [
        ["GET", ""], ["GET", "/:id"], ["POST", ""],
        ["PUT", "/:id"], ["PATCH", "/:id"], ["DELETE", "/:id"],
      ] as const) {
        routes.push({
          method,
          path: `${basePath}${suffix}`,
          file: rel,
          tags: detectTags(content),
          framework: "phoenix",
        });
      }
    }
  }

  return routes;
}

// --- Spring Boot (Java/Kotlin) ---
async function detectSpringRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const javaFiles = files.filter((f) => f.match(/\.(java|kt)$/));
  const routes: RouteInfo[] = [];

  for (const file of javaFiles) {
    const content = await readFileSafe(file);
    if (!content.includes("@RestController") && !content.includes("@Controller") && !content.includes("@RequestMapping")) continue;

    const rel = relative(project.root, file);

    // Extract class-level @RequestMapping
    const classMapping = content.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/);
    const basePath = classMapping ? classMapping[1] : "";

    // @GetMapping("/path"), @PostMapping("/path"), etc.
    const mappingPattern = /@(Get|Post|Put|Patch|Delete)Mapping\s*\(\s*(?:value\s*=\s*)?(?:["']([^"']*)["'])?\s*\)/gi;
    let match;
    while ((match = mappingPattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const subPath = match[2] || "";
      routes.push({
        method,
        path: basePath + subPath || "/",
        file: rel,
        tags: detectTags(content),
        framework: "spring",
      });
    }

    // @RequestMapping(method = RequestMethod.GET, value = "/path")
    const reqMappingPattern = /@RequestMapping\s*\([^)]*method\s*=\s*RequestMethod\.(\w+)[^)]*value\s*=\s*["']([^"']+)["']/gi;
    while ((match = reqMappingPattern.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: basePath + match[2],
        file: rel,
        tags: detectTags(content),
        framework: "spring",
      });
    }
  }

  return routes;
}

// --- Rust (Actix-web, Axum) ---
async function detectRustRoutes(
  files: string[],
  project: ProjectInfo,
  fw: Framework
): Promise<RouteInfo[]> {
  const rsFiles = files.filter((f) => f.endsWith(".rs"));
  const routes: RouteInfo[] = [];

  for (const file of rsFiles) {
    const content = await readFileSafe(file);
    const rel = relative(project.root, file);

    if (fw === "actix") {
      // #[get("/path")], #[post("/path")], etc.
      const attrPattern = /#\[(get|post|put|patch|delete)\s*\(\s*"([^"]+)"\s*\)\s*\]/gi;
      let match;
      while ((match = attrPattern.exec(content)) !== null) {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2],
          file: rel,
          tags: detectTags(content),
          framework: "actix",
        });
      }
      // .route("/path", web::get().to(handler))
      const routePattern = /\.route\s*\(\s*"([^"]+)"\s*,\s*web::(get|post|put|patch|delete)\s*\(\s*\)/gi;
      while ((match = routePattern.exec(content)) !== null) {
        routes.push({
          method: match[2].toUpperCase(),
          path: match[1],
          file: rel,
          tags: detectTags(content),
          framework: "actix",
        });
      }
    } else if (fw === "axum") {
      // .route("/path", get(handler)) or .route("/path", post(handler).get(handler))
      const routePattern = /\.route\s*\(\s*"([^"]+)"\s*,\s*(get|post|put|patch|delete)\s*\(/gi;
      let match;
      while ((match = routePattern.exec(content)) !== null) {
        routes.push({
          method: match[2].toUpperCase(),
          path: match[1],
          file: rel,
          tags: detectTags(content),
          framework: "axum",
        });
      }
    }
  }

  return routes;
}

// --- Raw HTTP (Node.js http.createServer, Deno, Bun.serve) ---
async function detectRawHttpRoutes(
  files: string[],
  project: ProjectInfo
): Promise<RouteInfo[]> {
  const tsFiles = files.filter((f) => f.match(/\.(ts|js|mjs|cjs)$/));
  const routes: RouteInfo[] = [];
  const globalSeen = new Set<string>();

  for (const file of tsFiles) {
    const content = await readFileSafe(file);
    // Only scan files that handle HTTP requests
    if (!content.match(/(?:createServer|http\.|req\.|request\.|url|pathname|Bun\.serve|Deno\.serve)/)) continue;

    const rel = relative(project.root, file);

    const patterns = [
      // Direct comparison: url === "/path" or pathname === "/path"
      /(?:url|pathname|parsedUrl\.pathname)\s*===?\s*['"`](\/[a-zA-Z0-9/_:.\-]+)['"`]/g,
      // startsWith: url.startsWith("/api")
      /(?:url|pathname)\s*\.startsWith\s*\(\s*['"`](\/[a-zA-Z0-9/_:.\-]+)['"`]\s*\)/g,
      // Switch case: case "/path":
      /case\s+['"`](\/[a-zA-Z0-9/_:.\-]+)['"`]\s*:/g,
    ];

    const fileTags = detectTags(content);

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const path = match[1];
        // Skip paths that are clearly not routes
        if (path.includes("\\") || path.length > 100 || path.includes("..")) continue;
        // Skip file extensions
        if (path.match(/\.\w{2,4}$/)) continue;

        const key = `${rel}:${path}`;
        if (globalSeen.has(key)) continue;
        globalSeen.add(key);

        // Try to detect method from surrounding context (within 300 chars)
        const surroundingStart = Math.max(0, match.index - 300);
        const surroundingEnd = Math.min(content.length, match.index + 300);
        const surrounding = content.substring(surroundingStart, surroundingEnd);

        let method = "ALL";
        const methodMatch = surrounding.match(/method\s*===?\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/i);
        if (methodMatch) {
          method = methodMatch[1].toUpperCase();
        }

        routes.push({
          method,
          path,
          file: rel,
          tags: fileTags,
          framework: "raw-http",
        });
      }
    }
  }

  return routes;
}
