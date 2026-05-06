import { User, Role, ServicePharma, PasswordReset, DetectedIssue, KnownIssueGenerate, } from './entities/entities.js';
import sequelize from '../config/db.js';
import { getEpisodeOfcareByUuid } from './patientsModels.js';

export default async function getUserWithRolesAndPermissions(email) {
  try {
    const query = `
      SELECT
        users.code,
        users.name,
        users.email,
        users.password,
        r.name AS role,
        STRING_AGG(p.name, ', ') AS permissions
      FROM
        users
      INNER JOIN
        public.role r ON users.id_rol = r.id
      INNER JOIN
        public.role_permission rp ON r.id = rp.role_id
      INNER JOIN
        public.permission p ON p.id = rp.permission_id
      WHERE email = ?
      GROUP BY
        users.password,
        users.code,
        users.name,
        users.email,
        r.name;
    `;
    const results = await sequelize.query(query, {
      replacements: [email],
      type: sequelize.QueryTypes.SELECT
    });

    return results;
  } catch (error) {
    console.error('Error origin: query');
    console.error(error);
    throw error;
  }
}

export async function getIdRolePharmaceutical() {
  try {
    const code = await Role.findOne({
      where: {
        name: 'Pharmaceutical'
      },
      attributes: ['id']
    });
    return code;
  } catch (error) {
    console.error('Error origin -> getIdRolePharmaceutical:', error);
    throw error;
  }
}

export async function getAllPharmacistsAndAssociates(code) {
  try {
    const query = `
                  WITH all_pharma AS (
                          SELECT u.name, u.last_name, u.identification, u.code
                          FROM users u
                        ),
                        pharma_selected AS (
                          SELECT u.name, u.last_name, u.identification, ep.code_episode
                          FROM users u
                          INNER JOIN public.service_pharma sp ON u.id = sp.user_id
                          INNER JOIN public.episode_of_care ep ON sp.episode_of_care_id = ep.id
                          WHERE ep.uuid = ?
                        )
                        SELECT al.name, al.code as ident, al.last_name, al.identification, ps.code_episode AS code
                        FROM all_pharma al
                        FULL OUTER JOIN pharma_selected ps ON ps.identification = al.identification;
    `;
    const results = await sequelize.query(query, {
      replacements: [code],
      type: sequelize.QueryTypes.SELECT
    });

    return results;
  } catch (error) {
    console.error('Error origin -> query:', error);
    throw error;
  }
}

export async function verifyAssociation(uuidEp, uuidUser) {
  const query = `
    SELECT *
    FROM service_pharma
    INNER JOIN public.users u ON u.id = service_pharma.user_id
    INNER JOIN public.episode_of_care eoc ON eoc.id = service_pharma.episode_of_care_id
    WHERE u.code = :uuidUser AND eoc.uuid = :uuidEp
  `;

  try {
    const result = await sequelize.query(query, {
      replacements: { uuidUser, uuidEp },
      type: sequelize.QueryTypes.SELECT,
    });

    return result;
  } catch (error) {
    console.error('Error origin -> query:', error);
    throw error;
  }
}

export async function createAssociation(codeEp, uuidUser) {
  try {

    const user = await User.findOne({ attributes: ['id'], where: { code: uuidUser } });

    const ep = await getEpisodeOfcareByUuid(codeEp);

    if (!ep || !user) {
      throw new Error('Service or User not found');
    }

    const result = await ServicePharma.create({
      episode_of_care_id: ep.id,
      user_id: user.id
    });

    return result;
  } catch (error) {
    console.error('Error origin query -> create association:', error);
    throw error;
  }
}

export async function deleteAssociation(codeEp, uuidUser) {
  try {

    const user = await User.findOne({ attributes: ['id', 'identification'], where: { code: uuidUser } });

    const ep = await getEpisodeOfcareByUuid(codeEp);

    if (!ep || !user) {
      throw new Error('Service or User not found');
    }

    const result = await ServicePharma.destroy({
      where: {
        episode_of_care_id: ep.id,
        user_id: user.id
      }
    });

    if (result === 0) {
      throw new Error('Association not found or already deleted');
    }

    return result;
  } catch (error) {
    console.error('Error origin query -> delete association:', error);
    throw error;
  }
}

export async function verifyEmail(emailVer) {
  try {

    const data = await User.findOne({
      attributes: ['id', 'email', 'identification', 'name'],
      where: {
        email: emailVer
      }
    });

    return data;

  } catch (error) {

    console.error('Error origin -> verifyEmail:', error);

    throw error;

  }
}

export async function createUser(data) {
  try {

    await User.create(data);

  } catch (error) {

    console.error('Error origin -> createUser:', error);

    throw error;

  }
}

export async function existUser(data) {
  try {

    const existingUser = await User.findOne({
      where: { email: data.email }
    });

    return existingUser;

  } catch (error) {

    console.error('Error origin -> existingUser:', error);

    throw error;

  }
}

export async function newPassword(emailUp, idenUp, passwordUp) {
  try {

    const updatedUser = await User.update(
      { password: passwordUp },
      { where: { email: emailUp, identification: idenUp } }
    );

    if (updatedUser) {
      return true;
    } else {
      throw new Error('User not Updated');
    }

  } catch (error) {

    console.error('Error origin -> resetPassword:', error);

    throw error;

  }
}

export async function saveTokenPassword(data) {
  try {

    const [updatedUser, created] = await PasswordReset.findOrCreate({
      where: { user_id: data.id_user },
      defaults: { token: data.token, generate: data.generate, used: 'F', user_id: data.id_user }
    });

    if (!created) {
      await updatedUser.update({ token: data.token, generate: data.generate, used: 'F' });
    }

    return updatedUser;
  } catch (error) {
    console.error('Error origin -> saveTokenPassword:', error);
    throw error;

  }
}

export async function getResetVerify(id_user) {
  try {
    const data = PasswordReset.findOne({
      attributes: ['generate', 'used'],
      where: {
        user_id: id_user
      }
    });

    return data

  } catch (error) {
    console.error('Error origin ->  getResetVerify:', error);
    throw error;
  }
}

export async function updateResetVerify(email) {
  try {

    const user = await User.findOne({ where: { email } });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }


    const updatedData = await PasswordReset.update(
      { used: 'T' },
      {
        where: { user_id: user.id },
        include: [{ model: User, as: 'User' }]
      }
    );

    return updatedData;
  } catch (error) {
    console.error('Error origin -> updateResetVerify:', error);
    throw error;
  }
}

export async function getUserIdByCode(uuid) {
  try {
    
    const data = await User.findOne({
      attributes: ['id'],
      where: {
        code: uuid
      },
    })

    return data;

  } catch (err) {
    console.error('Error getUserIdByCode from model: ->', err);
    throw err;
  }
}


export async function getAlertByCode(uuid) {
  try {

    let data;

    data = await DetectedIssue.findOne({
      attributes: ['id'],
      where: {
        uuid: uuid
      },
    })

    if (!data || !data.id) {

      data = await KnownIssueGenerate.findOne({
        attributes: ['id'],
        where: {
          uuid: uuid
        },
      });

    }

    return data;

  } catch (err) {
    console.error('Error getUserIdByCode from model: ->', err);
    throw err;
  }
}

export { User };