import { Table, Column, Model, ForeignKey } from "sequelize-typescript";
import UserModel from "./UserModel";

interface FriendInterface {
    userA: string;
    userB: string;
}

@Table({ tableName: "friends" })
class FriendModel extends Model<FriendInterface> {
    @ForeignKey(() => UserModel)
    @Column
    userA!: string;

    @ForeignKey(() => UserModel)
    @Column
    userB!: string;
}

export default FriendModel;