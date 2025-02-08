import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from "sequelize-typescript";
import UserModel from "./UserModel";

export interface SubscriptionInterface {
    endpoint: string;
    expirationTime?: null | number;
    p256dh: string;
    auth: string;
    username: string;
}

export interface SubscriptionInformation {
    endpoint: string;
    expirationTime?: null | number;
    keys: {
        p256dh: string;
        auth: string;
    }
}

@Table({ tableName: "subscriptions" })
class SubscriptionModel extends Model<SubscriptionInterface> {
    @Column({ type: DataType.STRING, primaryKey: true })
    public endpoint!: string;

    @Column(DataType.BIGINT) // Can be null if not set
    public expirationTime!: number | null;

    @Column(DataType.STRING)
    public p256dh!: string;

    @Column(DataType.STRING)
    public auth!: string;

    @ForeignKey(() => UserModel)
    @Column(DataType.STRING)
    public username!: string;

    @BelongsTo(() => UserModel)
    public user!: UserModel;

    public get fullSubcription(): SubscriptionInformation {
        return {
            endpoint: this.endpoint,
            expirationTime: this.expirationTime || null,
            keys: {
                p256dh: this.p256dh,
                auth: this.auth
            }
        }
    }
}

export default SubscriptionModel;