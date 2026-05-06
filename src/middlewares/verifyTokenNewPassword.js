import jwt from 'jsonwebtoken';


function tokenNewPassword(req, res, next) {

    const authHeader = req.headers['authorization'];

    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.KEY_FORGOT_PASSWORD, (err, user) => {

        if (err) return res.sendStatus(403);

        req.user = user;

        next();
    })
}

export default tokenNewPassword;