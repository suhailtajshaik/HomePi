import { SwitchButton } from "../../actuator/switch";
import * as admin from "firebase-admin";
import {ActuatorFactory, ActuatorType} from "../../../factory/ActuatorFactory";
import {NotificationSender} from "../../../util/NotificationSender";
import {Accessory} from "../Accessory";

export interface LightAccessoryConfig{
    name : string,
    room : string,
    actuatorType : ActuatorType,
    actuatorConfig : any,
    status : boolean,
    key : string
}

interface LightAccessoryInstance{
    working : boolean,
    user : string,
    status : boolean,
    config : any
}

export class LightAccessory implements Accessory{

    config : LightAccessoryConfig;
    switchButton : SwitchButton;
    ref : admin.database.Reference;
    callback : any;

    constructor(config : LightAccessoryConfig, db: admin.database.Database){
        this.config = config;
        this.switchButton = ActuatorFactory.build(config.actuatorType, config.actuatorConfig);
        this.callback = (snap) => {
            let instance = snap.val();
            if(this.hasToWork(instance)){
                this.ref.update(this.work(instance));
            }
        };

        if(db != null){
            this.ref = db.ref("service/" + this.config.key);
            this.ref.update({
                "name" : this.config.name,
                "key" : this.config.key,
                "status" : this.config.status,
                "date" : new Date(),
                "room" : this.config.room,
            });
            this.ref.on("value", this.callback);
        }


    }

    public hasToWork(instance : LightAccessoryInstance){
        return instance.working && instance.user !== process.env.SERVER_USER;
    }

    public work(instance : LightAccessoryInstance) : any {

        if(JSON.parse(instance.status+"")){
            this.switchButton.off();
            instance.status = false;
        }
        else{
            this.switchButton.on();
            instance.status = true;
        }

        if(instance.config && instance.config.notification){
            new NotificationSender().sendNotification({
                title : this.config.name + " - " + this.config.room,
                icon : "",
                body : "Ahora la luz esta " + (instance.status ? "encendida" : "apagada") + "."
            }, instance.config.notification.filter((id) => instance.user != id ));
        }


        return {
            "date" : new Date(),
            "status" : instance.status,
            "working" : false,
            "user" : process.env.SERVER_USER
        };
    }

    public destroy(){
        this.ref.off('value', this.callback);
    }


}