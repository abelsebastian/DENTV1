const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Audit logging middleware factory.
 * Usage: router.post('/', authenticate, audit('CREATE', 'Patient'), handler)
 */
function audit(action, entity) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      // Log after successful response (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user?.id) {
        const entityId = data?.id || req.params?.id || null;
        prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action,
            entity,
            entityId: entityId ? String(entityId) : null,
            details: action === 'DELETE'
              ? `Deleted ${entity} ${req.params?.id}`
              : `${action} ${entity}${entityId ? ` #${entityId.slice(0, 8)}` : ''}`,
          },
        }).catch(() => {}); // non-blocking
      }
      return originalJson(data);
    };
    next();
  };
}

module.exports = { audit };
