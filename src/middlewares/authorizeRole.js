import verifyPermission from '../models/permissionsModel.js';

export const authorize = (module, permission) => {
    return async (req, res, next) => {
        try {
            const code = req.user.id;

            if (!await verifyPermission(module, permission, code)) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            return next();
            
        } catch (error) {
            return next(error);
        }
    };
};

export default authorize;