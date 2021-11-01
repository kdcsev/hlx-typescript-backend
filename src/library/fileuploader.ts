import { curl_post } from "../helpers/curl";
import { DOMParser } from "xmldom";

import { NMI_IS_LIVE, UPLOAD_DIR } from "../var/env.config";
import { base64_encode, empty, get_data_value, is_null, number_format, serialize, trim_phone } from "../helpers/misc";
import { Logger } from "./logger";
import { vpsOrderQueueService } from "../services/vps.order.queue.service";
import { join, zip } from "lodash";
import * as path from 'path'
import * as fs from 'fs'

export default class FileUploader {
    public files: any;
    public publicStaticDir:string;
    public uploadDir:string;
    constructor(files: any) {
        this.files = files
        if(empty(UPLOAD_DIR)){
            this.publicStaticDir = path.join(__dirname, '../../src/public')
        }else{
            this.publicStaticDir = UPLOAD_DIR
        }

        this.uploadDir = path.join(this.publicStaticDir, 'uploads')
        if (!fs.existsSync(this.uploadDir)){
            fs.mkdirSync(this.uploadDir);
        }
        console.log('-------------uploadDir-------------',this.uploadDir)
    }

    public setFile = (files: any)=>{
        this.files = files
    }

    public uploadFile = async (file_key: string, uploadFolder: string = "") => {
        let files = this.files
        // Check if multiple files or a single file
        if (!files[file_key].length) {
            //Single file

            const file = files[file_key];

            // checks if the file is valid
            const isValid = this.isFileValid(file);
            //console.log('-------------------file--------------------',file)
            if (!isValid) {
                return [false, "Invalid file type"]
            }

            const isValidSize = this.isFileSizeValid(file);
            if (!isValidSize) {
                return [false, "The attachment is too big! The maximum file size is 5 MB."]
            }
            // creates a valid name by removing spaces
            const fileName = encodeURIComponent(file.name.replace(/\s/g, "-"));
         
            try {
                // renames the file in the directory
                const newFileName = "file_"+ Date.now() + '_' + fileName;
                let outputDir = this.uploadDir
                if(uploadFolder!==""){
                    outputDir = path.join(outputDir, uploadFolder) 
                    if (!fs.existsSync(outputDir)){
                        fs.mkdirSync(outputDir);
                    }
                }
                const outputPath = path.join(outputDir, newFileName) 
                fs.copyFileSync(file.path, outputPath);
                const filePath = "uploads/" + uploadFolder + "/" + newFileName
                console.log('-------------outputPath--------------', outputPath)
                return [true,  filePath]
            } catch (error) {
                console.log("-------file upload error---------", error);
                return [false, "Failed to upload file"]
            }
        } else {
            // Multiple files
        }
    }

    public isFileValid = (file: any) => {
        const type = file.type.split("/").pop();
        const validTypes = ["jpg", "jpeg", "png"];
        if (validTypes.indexOf(type) === -1) {
            return false;
        }
        return true;
    };

    public isFileSizeValid = (file: any) => {
        const maxUploadSize = 5 * 1024 * 1024
        const size = file.size;
        return size <= maxUploadSize
    };


}

export const fileUploader = new FileUploader(null)