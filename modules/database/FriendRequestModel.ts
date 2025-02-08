import { Column, DataType, ForeignKey, Model, Table } from "sequelize-typescript";
import UserModel from "./UserModel";

interface FriendRequestInterface {
    senderUsername: string;
    receiverUsername: string;
}

@Table({ tableName: "friend_requests" })
class FriendRequestModel extends Model<FriendRequestInterface> {
    @ForeignKey(() => UserModel)
    @Column({ type: DataType.STRING })
    senderUsername!: string;

    @ForeignKey(() => UserModel)
    @Column({ type: DataType.STRING })
    receiverUsername!: string;
}

export default FriendRequestModel;