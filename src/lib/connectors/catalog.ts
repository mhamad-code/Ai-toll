export type NativeKind = "github" | "gmail" | "gcalendar" | "gdrive"

export type Category =
  | "Code & Git"
  | "Docs for developers"
  | "Cloud & hosting"
  | "Databases"
  | "Monitoring & security"
  | "Project management"
  | "Communication"
  | "Docs & knowledge"
  | "Google"
  | "Microsoft"
  | "Business & payments"
  | "Design & content"

export type Connector = {
  id: string
  name: string
  description: string
  category: Category | "Custom"
  /** Simple Icons slug: the logo comes in the brand's own colour. */
  icon: string
  darkInvert: boolean
  /** Remote MCP endpoint, connected through OAuth in the browser. */
  mcpUrl?: string
  native?: NativeKind
  custom?: boolean
}

export type CustomConnector = { id: string; name: string; url: string }

type Row = [
  id: string,
  name: string,
  description: string,
  category: Category,
  icon: string,
  endpoint?: string,
]

/** Logos that are black and need inverting on a dark background. */
const BLACK_LOGOS = new Set([
  "github",
  "vercel",
  "notion",
  "railway",
  "square",
  "wix",
  "prisma",
])

/**
 * `native:` entries have their own integration; `https://` entries are remote
 * MCP servers; entries with no endpoint are listed but can't connect yet.
 */
const ROWS: Row[] = [
  // Code & Git
  ["github", "GitHub", "Browse repos, read files, manage issues and pull requests.", "Code & Git", "github", "native:github"],
  ["gitlab", "GitLab", "Projects, merge requests and pipelines.", "Code & Git", "gitlab", "https://gitlab.com/api/v4/mcp"],
  ["bitbucket", "Bitbucket", "Repositories and pull requests.", "Code & Git", "bitbucket"],
  ["azuredevops", "Azure DevOps", "Repos, boards and pipelines.", "Code & Git", "azuredevops"],
  ["githubactions", "GitHub Actions", "Workflow runs and logs.", "Code & Git", "githubactions"],
  ["circleci", "CircleCI", "Pipelines and build status.", "Code & Git", "circleci"],
  ["jenkins", "Jenkins", "Jobs and build history.", "Code & Git", "jenkins"],
  ["sonarqube", "SonarQube", "Code quality and open issues.", "Code & Git", "sonarqubeserver"],
  ["snyk", "Snyk", "Vulnerabilities in your dependencies.", "Code & Git", "snyk"],
  ["semgrep", "Semgrep", "Scan code for security problems.", "Code & Git", "semgrep", "https://mcp.semgrep.ai/sse"],
  ["socket", "Socket", "Risk scores for packages.", "Code & Git", "socketdotio", "https://mcp.socket.dev/"],
  ["postman", "Postman", "Collections and API requests.", "Code & Git", "postman"],
  ["npm", "npm", "Package info and versions.", "Code & Git", "npm"],
  ["docker", "Docker", "Containers and images.", "Code & Git", "docker"],
  // Docs for developers
  ["context7", "Context7", "Up-to-date docs for libraries and frameworks.", "Docs for developers", "upstash", "https://mcp.context7.com/mcp"],
  ["deepwiki", "DeepWiki", "Ask questions about any public GitHub repo.", "Docs for developers", "github", "https://mcp.deepwiki.com/mcp"],
  ["huggingface", "Hugging Face", "Models, datasets and Spaces.", "Docs for developers", "huggingface", "https://huggingface.co/mcp"],
  ["cloudflaredocs", "Cloudflare Docs", "Search the Cloudflare documentation.", "Docs for developers", "cloudflare", "https://docs.mcp.cloudflare.com/mcp"],
  ["stackoverflow", "Stack Overflow", "Questions and answers.", "Docs for developers", "stackoverflow"],
  ["wikipedia", "Wikipedia", "Look things up on Wikipedia.", "Docs for developers", "wikipedia"],
  // Cloud & hosting
  ["vercel", "Vercel", "Projects, deployments and logs.", "Cloud & hosting", "vercel", "https://mcp.vercel.com"],
  ["netlify", "Netlify", "Sites and deploys.", "Cloud & hosting", "netlify"],
  ["aws", "AWS", "Amazon Web Services resources.", "Cloud & hosting", "amazonaws"],
  ["googlecloud", "Google Cloud", "Projects and services on Google Cloud.", "Cloud & hosting", "googlecloud"],
  ["azure", "Azure", "Microsoft Azure resources.", "Cloud & hosting", "microsoftazure"],
  ["digitalocean", "DigitalOcean", "Droplets and apps.", "Cloud & hosting", "digitalocean"],
  ["heroku", "Heroku", "Apps and dynos.", "Cloud & hosting", "heroku"],
  ["railway", "Railway", "Services and deployments.", "Cloud & hosting", "railway"],
  ["render", "Render", "Web services and databases.", "Cloud & hosting", "render"],
  ["flyio", "Fly.io", "Machines and apps.", "Cloud & hosting", "flydotio"],
  ["kubernetes", "Kubernetes", "Clusters and workloads.", "Cloud & hosting", "kubernetes"],
  ["terraform", "Terraform", "Infrastructure as code.", "Cloud & hosting", "terraform"],
  // Databases
  ["supabase", "Supabase", "Projects, tables and SQL.", "Databases", "supabase", "https://mcp.supabase.com/mcp"],
  ["neon", "Neon", "Serverless Postgres branches and queries.", "Databases", "neon", "https://mcp.neon.tech/mcp"],
  ["planetscale", "PlanetScale", "Databases and branches.", "Databases", "planetscale", "https://mcp.pscale.dev/mcp/planetscale"],
  ["prisma", "Prisma", "Prisma Postgres and migrations.", "Databases", "prisma", "https://mcp.prisma.io/mcp"],
  ["mongodb", "MongoDB", "Collections and documents.", "Databases", "mongodb"],
  ["postgresql", "PostgreSQL", "Query a Postgres database.", "Databases", "postgresql"],
  ["mysql", "MySQL", "Query a MySQL database.", "Databases", "mysql"],
  ["redis", "Redis", "Keys and data structures.", "Databases", "redis"],
  ["elasticsearch", "Elasticsearch", "Indices and search.", "Databases", "elasticsearch"],
  ["firebase", "Firebase", "Firestore, auth and hosting.", "Databases", "firebase"],
  ["upstash", "Upstash", "Serverless Redis and Kafka.", "Databases", "upstash"],
  ["snowflake", "Snowflake", "Warehouse queries.", "Databases", "snowflake"],
  ["clickhouse", "ClickHouse", "Analytics queries.", "Databases", "clickhouse"],
  // Monitoring & security
  ["sentry", "Sentry", "Errors, issues and releases.", "Monitoring & security", "sentry", "https://mcp.sentry.dev/mcp"],
  ["datadog", "Datadog", "Metrics, logs and monitors.", "Monitoring & security", "datadog"],
  ["grafana", "Grafana", "Dashboards and alerts.", "Monitoring & security", "grafana"],
  ["newrelic", "New Relic", "Application performance data.", "Monitoring & security", "newrelic"],
  ["pagerduty", "PagerDuty", "Incidents and on-call schedules.", "Monitoring & security", "pagerduty", "https://mcp.pagerduty.com/mcp"],
  ["prometheus", "Prometheus", "Metrics queries.", "Monitoring & security", "prometheus"],
  ["auth0", "Auth0", "Users and applications.", "Monitoring & security", "auth0"],
  ["okta", "Okta", "Identity and access.", "Monitoring & security", "okta"],
  // Project management
  ["linear", "Linear", "Issues, projects and cycles.", "Project management", "linear", "https://mcp.linear.app/mcp"],
  ["atlassian", "Jira & Confluence", "Tickets and wiki pages.", "Project management", "jira", "https://mcp.atlassian.com/v1/sse"],
  ["asana", "Asana", "Tasks and projects.", "Project management", "asana", "https://mcp.asana.com/sse"],
  ["trello", "Trello", "Boards and cards.", "Project management", "trello"],
  ["clickup", "ClickUp", "Tasks and docs.", "Project management", "clickup"],
  ["monday", "monday.com", "Boards and items.", "Project management", "mondaydotcom", "https://mcp.monday.com/sse"],
  ["airtable", "Airtable", "Bases and records.", "Project management", "airtable"],
  // Communication
  ["slack", "Slack", "Channels and messages.", "Communication", "slack"],
  ["discord", "Discord", "Servers and channels.", "Communication", "discord"],
  ["telegram", "Telegram", "Chats and bots.", "Communication", "telegram"],
  ["teams", "Microsoft Teams", "Teams and chats.", "Communication", "microsoftteams"],
  ["zoom", "Zoom", "Meetings and recordings.", "Communication", "zoom"],
  ["twilio", "Twilio", "SMS and calls.", "Communication", "twilio"],
  ["sendgrid", "SendGrid", "Transactional email.", "Communication", "sendgrid"],
  ["mailchimp", "Mailchimp", "Audiences and campaigns.", "Communication", "mailchimp"],
  ["intercom", "Intercom", "Conversations and contacts.", "Communication", "intercom", "https://mcp.intercom.com/sse"],
  ["zendesk", "Zendesk", "Support tickets.", "Communication", "zendesk"],
  // Docs & knowledge
  ["notion", "Notion", "Pages and databases.", "Docs & knowledge", "notion", "https://mcp.notion.com/mcp"],
  ["dropbox", "Dropbox", "Files and folders.", "Docs & knowledge", "dropbox"],
  ["box", "Box", "Files and content.", "Docs & knowledge", "box", "https://mcp.box.com"],
  // Google
  ["gmail", "Gmail", "Search and read your email.", "Google", "gmail", "native:gmail"],
  ["gcalendar", "Google Calendar", "See and create events.", "Google", "googlecalendar", "native:gcalendar"],
  ["gdrive", "Google Drive", "Search your files.", "Google", "googledrive", "native:gdrive"],
  ["gdocs", "Google Docs", "Read and edit documents.", "Google", "googledocs"],
  ["gsheets", "Google Sheets", "Read and edit spreadsheets.", "Google", "googlesheets"],
  ["youtube", "YouTube", "Videos and channels.", "Google", "youtube"],
  ["gmaps", "Google Maps", "Places and directions.", "Google", "googlemaps"],
  ["ganalytics", "Google Analytics", "Traffic and conversions.", "Google", "googleanalytics"],
  // Microsoft
  ["outlook", "Outlook", "Mail and calendar.", "Microsoft", "microsoftoutlook"],
  ["onedrive", "OneDrive", "Files in the cloud.", "Microsoft", "microsoftonedrive"],
  ["sharepoint", "SharePoint", "Sites and documents.", "Microsoft", "microsoftsharepoint"],
  // Business & payments
  ["stripe", "Stripe", "Payments, customers and subscriptions.", "Business & payments", "stripe", "https://mcp.stripe.com"],
  ["paypal", "PayPal", "Payments and invoices.", "Business & payments", "paypal", "https://mcp.paypal.com/sse"],
  ["square", "Square", "Sales, catalog and customers.", "Business & payments", "square", "https://mcp.squareup.com/sse"],
  ["shopify", "Shopify", "Products and orders.", "Business & payments", "shopify"],
  ["salesforce", "Salesforce", "CRM records.", "Business & payments", "salesforce"],
  ["hubspot", "HubSpot", "Contacts and deals.", "Business & payments", "hubspot"],
  ["quickbooks", "QuickBooks", "Accounting data.", "Business & payments", "quickbooks"],
  ["xero", "Xero", "Invoices and accounts.", "Business & payments", "xero"],
  // Design & content
  ["figma", "Figma", "Files, frames and components.", "Design & content", "figma", "https://mcp.figma.com/mcp"],
  ["canva", "Canva", "Designs and brand assets.", "Design & content", "canva", "https://mcp.canva.com/mcp"],
  ["webflow", "Webflow", "Sites and CMS.", "Design & content", "webflow", "https://mcp.webflow.com/sse"],
  ["wix", "Wix", "Sites and stores.", "Design & content", "wix", "https://mcp.wix.com/sse"],
  ["wordpress", "WordPress", "Posts and pages.", "Design & content", "wordpress"],
  ["contentful", "Contentful", "Content models and entries.", "Design & content", "contentful"],
  ["sanity", "Sanity", "Structured content.", "Design & content", "sanity", "https://mcp.sanity.io"],
  ["cloudinary", "Cloudinary", "Images and video.", "Design & content", "cloudinary"],
  ["algolia", "Algolia", "Search indices.", "Design & content", "algolia"],
]

export const CATALOG: Connector[] = ROWS.map(
  ([id, name, description, category, icon, endpoint]) => ({
    id,
    name,
    description,
    category,
    icon,
    darkInvert: BLACK_LOGOS.has(icon),
    mcpUrl: endpoint?.startsWith("https://") ? endpoint : undefined,
    native: endpoint?.startsWith("native:")
      ? (endpoint.slice(7) as NativeKind)
      : undefined,
  })
)

export const CATEGORIES: string[] = [...new Set(CATALOG.map((c) => c.category))]

export const isAvailable = (c: Connector) => Boolean(c.mcpUrl || c.native)

export function customToConnector(c: CustomConnector): Connector {
  return {
    id: c.id,
    name: c.name,
    description: c.url,
    category: "Custom",
    icon: "",
    darkInvert: false,
    mcpUrl: c.url,
    custom: true,
  }
}

export function allConnectors(custom: CustomConnector[]): Connector[] {
  return [...custom.map(customToConnector), ...CATALOG]
}
