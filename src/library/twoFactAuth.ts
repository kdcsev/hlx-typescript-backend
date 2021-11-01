import { generateSecret } from '@authentication/google-authenticator';
import { getQRCodeSVG, getQRCodeURI } from '@authentication/google-authenticator';
import { verifyToken } from '@authentication/google-authenticator';

import { number_format } from "../helpers/misc";
import { Logger } from "./logger";

export default class TwoFactAuth {
    constructor() {

    }
    public getGaSecret = async () => {
        const gaSecret = await generateSecret()
        return gaSecret
    }
    public getGaQRCode = async (gaSecret: string, lebel: string, issuer: string = "") => {
        // const svg = await getQRCodeSVG({
        //     secret: gaSecret,
        //     label: lebel,
        //     issuer: issuer
        // });
        // const uri = getQRCodeURI({
        //     secret: user.gaSecret,
        //     label: 'MyApp:user@example.com',
        //     issuer: 'MyApp'
        // });
        const uri = getQRCodeURI({
            secret: gaSecret,
            label: lebel,
            issuer: issuer
        });
        return uri
    }

    public verifyCode = async (token: string, gaSecret: string) => {
        if (verifyToken({ secret: gaSecret, token:token, window:2 }) === true) {
            // verified token
            return true
        }else{
            return false
        }
    }
}

export const twoFactAuth = new TwoFactAuth()