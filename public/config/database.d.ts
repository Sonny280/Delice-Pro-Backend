import type { PrismaClient as PrismaClientType } from "@prisma/client";
declare global {
    var prisma: PrismaClientType | undefined;
}
declare const prisma: PrismaClientType;
export default prisma;
//# sourceMappingURL=database.d.ts.map