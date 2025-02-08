import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import UserModel from "./UserModel";

interface BlockedUserInterface {
    blocker: string;
    blocked: string;
}

@Table({ tableName: "blocked_users" })
class BlockedUserModel extends Model<BlockedUserInterface> {
    @ForeignKey(() => UserModel)
    @Column({ type: DataType.STRING })
    blocker!: string;

    @ForeignKey(() => UserModel)
    @Column({ type: DataType.STRING })
    blocked!: string;
}

export default BlockedUserModel;