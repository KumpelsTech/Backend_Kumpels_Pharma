import jwt from 'jsonwebtoken';

const REFRESH_TOKEN_SECRET = process.env.REFRESH_SECRET_KEY;

function verifyRefreshToken(req, res, next) {

	const refreshToken = req.cookies.refreshToken;

	if (!refreshToken) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	try {
		const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
		req.userData = decoded;
		next();
	} catch (error) {
		console.error('Error verifying refresh token:', error);
		return res.status(401).json({ error: 'Invalid token' });
	}
}

export default verifyRefreshToken;
