import jwt from 'jsonwebtoken'
import moment from 'moment'

export function calculatePagination(page, limit) {

    const end = page * limit;
    
    const start = (end - limit) + 1;

    return [start, end, limit];

}

export function formatDate(dateString) {
    if (!dateString) return null;

    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
}

export function getAge(dateString) {

    var today = new Date();
    var birthDate = new Date(dateString);
    var age = today.getFullYear() - birthDate.getFullYear();
    var m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;

}

export function generateAccessToken(id, role, permissions, name) {

    const payload = { id, role, permissions, name };

    const timeToken = process.env.TOKEN_EXPIRY.toString();

    return jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: timeToken });
}

export function generateRefreshToken(email) {

    const payload = { email };

    const timeRefresh = process.env.REFRESH_TOKEN_EXPIRY.toString()

    return jwt.sign(payload, process.env.REFRESH_SECRET_KEY, { expiresIn: timeRefresh })
}

export function decodeJWT(token) {
    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        return decoded;
    } catch (error) {
        console.error('Error decoding JWT:', error);
        return null;
    }
}

export function convert(value, original_unit, target_unit) {

    if (value === null || value === undefined) {
        return 0;
    }

    const conversions = {
        'kg': {
            'lb': value * 2.20462,
            'g': value * 1000
        },
        'm': {
            'cm': value * 100,
            'ft': value * 3.28084
        },
        'C': {
            'F': (value * 9 / 5) + 32
        },
        'mg/dL': {
            'mmol/L': value * 0.0555
        },
    };

    if (original_unit === target_unit) {
        return value;
    } else if (conversions[original_unit] && conversions[original_unit][target_unit]) {
        return conversions[original_unit][target_unit];
    } else if (conversions[target_unit] && conversions[target_unit][original_unit]) {
        return value / conversions[target_unit][original_unit];
    } else {

        throw new Error(`No se puede convertir de ${original_unit} a ${target_unit}`);
    }
}

export function parseDateTime(str) {
    let formattedDate = moment(str, "DD-MM-YYYY HH:mm", "America/Bogota").format("YYYY-MM-DD HH:mm:ss.SSSSSS");
    return formattedDate;
}

export function buildFilters(query) {
    try {
        const { pattern, value, field, type, operator, second_operator } = query;

        let functionQuery = '';

        if (pattern !== 'range' && pattern !== 'custom') {
            const isContain = pattern === 'contain';

            if (type === 'number') {
                functionQuery = isContain
                    ? `CAST(${field} AS TEXT) ILIKE '${value}%'`
                    : `${field} = ${value}`;
            } else if (type === 'string') {
                functionQuery = isContain
                    ? `${field}::TEXT ILIKE '%${value}%'`
                    : `${field}::TEXT = '${value}'`;
            } else if (type === 'date') {
                const formattedValue = `TO_DATE('${value}', 'YYYY-MM-DD')`;
                functionQuery = isContain
                    ? `${field}::DATE::TEXT ILIKE '%${value}%'`
                    : `${field}::DATE = ${formattedValue}`;
            } else if (type === 'boolean') {
                if (value === 'true') {
                    functionQuery = isContain
                        ? ''
                        : `(${field} IS NOT NULL OR NOT ${field} = '')`;
                } else {
                    functionQuery = isContain
                        ? ''
                        : `(${field} IS NULL OR ${field} = '')`;
                }
            }
        } else if (pattern === 'range') {
            const [start, end] = value;
            if (type === 'number') {
                functionQuery = `${field} BETWEEN ${start} AND ${end}`;
            } else if (type === 'string') {
                functionQuery = `${field} BETWEEN '${start}' AND '${end}'`;
            } else if (type === 'date') {
                const formattedStart = `TO_DATE('${start}', 'YYYY-MM-DD')`;
                const formattedEnd = `TO_DATE('${end}', 'YYYY-MM-DD')`;
                functionQuery = `${field}::DATE BETWEEN ${formattedStart} AND ${formattedEnd}`;
            }
        } else if (pattern === 'custom') {
            if (type === 'number') {
                if (Array.isArray(value) && value.length === 2) {
                    functionQuery = `${field} ${operator} ${value[0]} AND ${field} ${second_operator} ${value[1]}`;
                } else {
                    functionQuery = `${field} ${operator} ${value}`;
                }
            } else if (type === 'string') {
                functionQuery = `${field} ${operator} '${value}'`;
            } else if (type === 'date') {
                const formattedValue = `TO_DATE('${value}', 'YYYY-MM-DD')`;
                functionQuery = `${field}::DATE ${operator} ${formattedValue}`;
            }
        }

        return functionQuery;

    } catch (error) {
        console.error('Error in build filter:', error);
        throw error;
    }
}


export function generateDateNow() {

    const nowInBogota = moment().tz('America/Bogota');

    const formattedDate = nowInBogota.format('DD-MM-YYYY HH:mm');

    return formattedDate;
}

export function getMinutesDifference(date1, date2) {

    const momentDate1 = moment.tz(date1, 'DD-MM-YYYY HH:mm', 'America/Bogota');
    const momentDate2 = moment.tz(date2, 'DD-MM-YYYY HH:mm', 'America/Bogota');

    const diffMinutes = momentDate2.diff(momentDate1, 'minutes');

    return diffMinutes;
}

export function roundToTwoDigits(number) {
    return Math.round(number * 100) / 100;
}
