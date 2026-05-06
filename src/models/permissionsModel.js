import sequelize from '../config/db.js';

const BASE_GUARD = 'Pharma_Patients';

const SCOPE = 'Api_web';

const MODULES = ['Module_Patients', 'Module_Details', 'Module_Paraclinical', 'Module_Medication', 'Module_Alerts'];

const verifyPermission = async (module, permission, userCode) => {
    try {

        if (!MODULES.includes(module)) {
            throw new Error('The module to check permissions is not a match');
        }

        const guard_name = BASE_GUARD + '.' + SCOPE + '.' + module;

        const query = `SELECT 1
                            FROM users u
                                    INNER JOIN public.role r on u.id_rol = r.id
                                    INNER JOIN public.role_permission rp on r.id = rp.role_id
                                    INNER JOIN public.permission p on p.id = rp.permission_id
                            WHERE p.guard_name = ?
                            AND p.name = ?
                            AND u.code = ?
                    `;

        const replacements = [guard_name, permission, userCode];

        const results = await sequelize.query(query, {
            replacements: replacements,
            type: sequelize.QueryTypes.SELECT
        });

        if (!results || results.length === 0) return false;

        return true;

    } catch (error) {
        console.error('Error origin permissions -> verifying permissions: ', error);
        throw error;
    }
};

export default verifyPermission;
