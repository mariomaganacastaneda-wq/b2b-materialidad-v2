import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { createClerkClient } from "@clerk/backend";
import { z } from "zod";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
    console.error("Error: CLERK_SECRET_KEY no encontrada en .env");
    process.exit(1);
}
const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
const server = new Server({
    name: "clerk-admin-mcp",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Esquemas de validación
const UpdateUserMetadataSchema = z.object({
    userId: z.string(),
    publicMetadata: z.record(z.string(), z.any()).optional(),
    privateMetadata: z.record(z.string(), z.any()).optional(),
});
const CreateOrganizationSchema = z.object({
    name: z.string(),
    createdBy: z.string(),
    slug: z.string().optional(),
});
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_users",
                description: "Lista los usuarios de la instancia de Clerk",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: { type: "number", description: "Número de usuarios a devolver (max 500)" },
                        offset: { type: "number", description: "Desplazamiento para paginación" },
                    },
                },
            },
            {
                name: "get_organizations",
                description: "Lista las organizaciones de la instancia de Clerk",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: { type: "number" },
                        offset: { type: "number" },
                    },
                },
            },
            {
                name: "update_user_metadata",
                description: "Actualiza los metadatos públicos o privados de un usuario",
                inputSchema: {
                    type: "object",
                    properties: {
                        userId: { type: "string" },
                        publicMetadata: { type: "object" },
                        privateMetadata: { type: "object" },
                    },
                    required: ["userId"],
                },
            },
            {
                name: "create_organization",
                description: "Crea una nueva organización en Clerk",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        createdBy: { type: "string", description: "ID del usuario que crea la org" },
                        slug: { type: "string" },
                    },
                    required: ["name", "createdBy"],
                },
            },
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "get_users": {
                const users = await clerk.users.getUserList({
                    limit: Number(args?.limit) || 10,
                    offset: Number(args?.offset) || 0,
                });
                return { content: [{ type: "text", text: JSON.stringify(users, null, 2) }] };
            }
            case "get_organizations": {
                const orgs = await clerk.organizations.getOrganizationList({
                    limit: Number(args?.limit) || 10,
                    offset: Number(args?.offset) || 0,
                });
                return { content: [{ type: "text", text: JSON.stringify(orgs, null, 2) }] };
            }
            case "update_user_metadata": {
                const parsed = UpdateUserMetadataSchema.parse(args);
                const user = await clerk.users.updateUserMetadata(parsed.userId, {
                    publicMetadata: parsed.publicMetadata,
                    privateMetadata: parsed.privateMetadata,
                });
                return { content: [{ type: "text", text: `Metadatos actualizados para ${user.id}` }] };
            }
            case "create_organization": {
                const parsed = CreateOrganizationSchema.parse(args);
                const org = await clerk.organizations.createOrganization({
                    name: parsed.name,
                    createdBy: parsed.createdBy,
                    slug: parsed.slug,
                });
                return { content: [{ type: "text", text: `Organización creada: ${org.name} (${org.id})` }] };
            }
            default:
                throw new Error(`Herramienta no encontrada: ${name}`);
        }
    }
    catch (error) {
        return {
            isError: true,
            content: [{ type: "text", text: `Error en Clerk MCP: ${error.message}` }],
        };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Clerk Admin MCP server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
