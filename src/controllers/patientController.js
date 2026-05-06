import { calculatePagination, getAge, formatDate, buildFilters } from "../helpers/helpers.js";
import { getPatientsData, createDataPatientFromDataHospital, getDetailsPatient, getPatientAlertsByUuid, getAllTotalPatients, searchGenderByPatient, searchDiagnosisByCode, searchMedicationByAllergy, getDiagnosisByService, getAllergiesByService, dataPatientForSearch, getAllActiveTotalPatients, getPatientsDataPharmacist, searchPatientForOptions, getRecentEpisodeByIdentificationPatient, getPatientAlertsGenerateByUuid, getTotalPatientAlerts } from "../models/patientsModels.js";

export async function getPatients(page, limit, filters) {
    try {

        let queryFilters = '';

        let isSeacrhWithPharma = false;

        if (filters && filters.length > 0) {
            filters.forEach((filter, index) => {
                if (filter.field === 'active') {
                    filter.field = 'period_end';
                } else if (filter.field == 'pharma') {

                    isSeacrhWithPharma = true;

                }

                const filterString = buildFilters(filter);

                queryFilters += (index === 0 ? '' : ' AND ') + filterString;
            });
        }


        const paginate = calculatePagination(page, limit);

        let data;

        if (isSeacrhWithPharma) {
            data = await getPatientsDataPharmacist(paginate[0], paginate[1], paginate[2], queryFilters);
        } else {
            data = await getPatientsData(paginate[0], paginate[1], paginate[2], queryFilters);
        }

        const totalPatients = await getAllTotalPatients();
        const totalPatientsActive = await getAllActiveTotalPatients();

        const resultsArray = Array.isArray(data) ? data : [data];

        if (resultsArray.length > 0) {
            const modifiedResults = resultsArray.map(result => {
                const name = result.first_name.trim() + ' ' + result.last_name.trim();
                const age = getAge(result.birth_date);
                const isActive = result.period_end ? false : true;
                const identificationFormat = result.t_identification.trim() + ' ' + result.identification.trim();

                return {
                    ...result,
                    name,
                    age,
                    isActive,
                    identificationFormat
                };
            });

            return {
                totalPatients,
                totalPatientsActive,
                patients: modifiedResults
            };
        } else {
            return { message: 'Data not found', totalPatients };
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
}

export async function createFlowPatients(data) {
    try {
        for (const resp of data) {

            resp.first_name = resp.first_name.toUpperCase();
            resp.second_name = resp.second_name.toUpperCase();
            resp.last_name = resp.last_name.toUpperCase();
            resp.second_last_name = resp.second_last_name.toUpperCase();
            resp.doctor_name = resp.doctor_name.toUpperCase();
            resp.gender_id = await searchGenderByPatient(resp.sex);
            resp.p_diagnostic = await buildDiagnostic(resp.p_diagnostic, 'principal');
            resp.s_diagnostic = await buildDiagnostic(resp.s_diagnostic, 'secondary');
            resp.allergies = await buildAllergies(resp.id_allergies);

            // El estado se puede hacer dinámico pero se deja en defecto como activo
            resp.status_episode = 3;

            // El servicio se deja por defecto 2 que es el hospital, se debará cambiar para que sea dinámico 
            resp.service_provider = 2;

            await createDataPatientFromDataHospital(resp);
        }

        return { 'message': 'flow created' };
    } catch (err) {
        console.error('Error create flow data patient origin from controller: ->', err);
        throw err;
    }
}

export async function getAllDetailsPatient(resp) {
    try {
        const { first_name, last_name, birth_date, t_identification, identification, medical_service, administrative_gender } = await getDetailsPatient(resp.uuid);

        if (!first_name) return { "message": "Data not found" };

        const name = `${first_name.trim()} ${last_name.trim()}`;
        const age = getAge(birth_date);
        const birthDateFormatted = formatDate(birth_date);
        const sex = administrative_gender.symbol
        const identificationFormat = `${t_identification.trim()} ${identification.trim()}`;

        //const alerts = await getPatientAlertsByUuid(resp.uuid);

        //const alertsGenerate = await getPatientAlertsGenerateByUuid(resp.uuid);

        const totalAlerts = await getTotalPatientAlerts(resp.uuid);

        const episodeOfCare = medical_service.episode_of_cares[0];

        const period_start_format = formatDate(episodeOfCare.period_start);

        const period_end_format = formatDate(episodeOfCare.period_end);

        const diagnosis = await getDiagnosisByService(medical_service.id);

        const allergies = await getAllergiesByService(medical_service.id);

        return {
            'epId': episodeOfCare.uuid,
            'alerts': Number(totalAlerts),
            age,
            name,
            sex,
            identificationFormat,
            birthDateFormatted,
            data: { medical_service, period_start_format, period_end_format },
            diagnosis,
            allergies
        };

    } catch (err) {
        console.error('Error al obtener los detalles del paciente desde el controlador:', err.message);
        throw err;
    }
}

export async function searchPatient(criteria) {
    try {

        const data = await dataPatientForSearch(criteria);

        return data;

    } catch (err) {
        console.error('Error desde el controlador al buscar:', err.message);
        throw err;
    }
}

export async function searchPatientChain(criteria) {
    try {
        const data = await searchPatientForOptions(criteria.pattern);

        if (data && data.length >= 1) {
            const updatedData = await Promise.all(data.map(async (resp) => {
                const episode = await getRecentEpisodeByIdentificationPatient(resp.identification);
                if (episode && episode.uuid) {
                    return {
                        ...resp.get({ plain: true }),
                        'episode': episode.uuid
                    };
                }
                return null;
            }));

            return updatedData.filter(item => item !== null);
        }

        return data;

    } catch (err) {
        console.error('Error origin controller:', err.message);
        throw err;
    }
}

async function buildDiagnostic(textDiagnostic, categoryDiagnostic) {
    try {
        const objectDiagnostic = formatDiagnosticGenerate(textDiagnostic);
        const diagnosticList = [];

        await Promise.all(objectDiagnostic.map(async (dataDiag) => {
            const idDiagnostic = await searchDiagnosisByCode(dataDiag[0]);
            const structObject = {
                // El role diagnosis se puede hacer dinámico pero por ahora se deja como 'admission-diagnosis' hasta que se tengan otros criterios
                'role_diagnosis': 1,
                // Este atributo hace referencia al rank report para diferenciar de diagnosticos primarios y  secundarios
                'category': categoryDiagnostic,
                'date_report': dataDiag[1],
                'id_diagnosis': '',
                'observations': ''
            };

            if (idDiagnostic) {
                structObject.id_diagnosis = idDiagnostic;
                structObject.observations = dataDiag[2];
            } else {
                structObject.id_diagnosis = null;
                structObject.observations = 'Código de Diagnostico sin identificación';
            }

            diagnosticList.push(structObject);
        }));

        return diagnosticList;

    } catch (err) {
        console.error('Error build diagnostic origin controller: ->', err);
        throw err;
    }
}

async function buildAllergies(objectAllergies) {
    try {

        const allergies = formatAllergiesGenerate(objectAllergies);

        const allergiesList = [];

        await Promise.all(allergies.map(async (dataAl) => {
            if (dataAl) {
                const medication = await searchMedicationByAllergy(dataAl);

                const structObject = {
                    'code': dataAl,
                    'observation': '',
                    'medication_id': '',
                };

                if (medication) {
                    structObject.medication_id = medication;
                } else {
                    structObject.medication_id = null;
                    structObject.observation = 'Código de alergia sin identificación';
                }

                allergiesList.push(structObject);
            }

        }));

        return allergiesList;

    } catch (err) {
        console.error('Error build diagnostic origin controller: ->', err);
        throw err;
    }
}

function formatDiagnosticGenerate(text) {

    let diagnostics;

    const cleanedInput = text.replace(/\s/g, "");

    if (!cleanedInput.includes(';')) {

        diagnostics = cleanedInput.match(/^([^ ]+)-(\d{4}-\d{2}-\d{2})-(.+)/).slice(1);

        return [diagnostics]

    } else {

        const dateRegex = /\b\d{4}-\d{2}-\d{2}\b/g;

        const dates = cleanedInput.match(dateRegex);

        const stringWithoutDates = cleanedInput.replace(dateRegex, '').replace(/;;+/g, ';').replace(/-;-/g, '-').split('-');

        const codesAndStatus = stringWithoutDates.map(segment => segment.split(';'));

        const statuses = codesAndStatus[1];

        diagnostics = codesAndStatus[0].map((code, index) => [code, dates[index], statuses[index]]);

        return diagnostics
    }

};

function formatAllergiesGenerate(alerg) {
    const allergies = alerg.trim().split(';');
    return allergies
}
