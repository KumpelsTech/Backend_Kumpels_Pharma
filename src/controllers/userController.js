import { User, getIdRolePharmaceutical, getAllPharmacistsAndAssociates, verifyAssociation, deleteAssociation, createAssociation } from '../models/userModels.js';
import bc from 'bcrypt';


export async function createUser(userData) {
  try {
    const existingUser = await User.findOne({
      where: { email: userData.email }
    });

    if (existingUser) {
      return { status: 400, message: 'Email already exists' };
    }

    const saltRounds = 10;
    const hashedPassword = await bc.hash(userData.password, saltRounds);

    userData.password = hashedPassword;
    userData.id_rol = await getIdRolePharmaceutical();
    userData.code = await generateUniqueUUID();

    await User.create(userData);
    return { status: 201, message: 'User Created' };

  } catch (error) {
    return { status: 500, message: error.message };
  }
}


export async function getAllPharmacistWithAssociates(code) {
  try {
    const data = await getAllPharmacistsAndAssociates(code);

    const respFormat = data.map(resp => ({
      name: `${resp.name}${resp.lastname ? resp.lastname : ''} - ${resp.identification}`,
      identification: resp.ident,
      code: !!resp.code
    }));

    return { respFormat };

  } catch (error) {
    return { status: 500, message: 'Error origin -> controller: ' + error.message };
  }
}



async function handleAssociation(codeEp, codeUser, status) {

  const data = await verifyAssociation(codeEp, codeUser);

  if (data.length >= 1 && !status) {

    const result = await deleteAssociation(codeEp, codeUser);

    if (result) {
      return { message: 'El farmacista ya no está asociado' };
    }

  } else if (data.length < 1 && status) {

    const result = await createAssociation(codeEp, codeUser);

    if (result) {
      return { message: 'El farmacista está asociado' };
    }

  }

  return { data };
}


export async function assignPharmacistToPatient(codeEp, codeUser, status) {
  try {
    return await handleAssociation(codeEp, codeUser, status);
  } catch (error) {
    console.error('Error origin -> controller: ' + error.message);
    throw error;
  }
}

export async function getAssociation(codeService, codeUser) {
  try {
    const resp = await verifyAssociation(codeService, codeUser)

    if (resp.length >= 1) {
      return { 'assigned': true };
    } else {
      return { 'assigned': false };
    }
  } catch (error) {
    console.error('Error origin -> controller: ' + error.message);
    throw error;
  }
}

export async function autoAssignPharmacistToPatient(codeService, codeUser, codeVerify, status) {
  try {
    if (codeUser === codeVerify) {
      return await handleAssociation(codeService, codeUser, status);
    } else {
      throw new Error('Error de autoasignación');
    }
  } catch (error) {
    console.error('Error origin -> controller: ' + error.message);
    throw error;
  }
}


export async function generateUniqueUUID() {
  let userWithUUID;
  let uuid;

  do {
    uuid = crypto.randomUUID();
    userWithUUID = await User.findOne({ where: { code: uuid } });
  } while (userWithUUID);

  return uuid;
}