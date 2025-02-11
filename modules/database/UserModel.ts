import { BelongsToMany, Column, DataType, HasMany, Model, Table } from "sequelize-typescript";
import FriendModel from "./FriendModel";
import FriendRequestModel from "./FriendRequestModel";
import BlockedUserModel from "./BlockedUserModel";
import { Op } from "sequelize";
import SubscriptionModel, { SubscriptionInformation } from "./SubscriptionModel";
import { lastOnline, sendPushNotification } from "../push";

interface UserInterface {
    id: string;
    realName: string;
    username: string;
    score: number;
    wins: number;
    silent: boolean;
    lastInvite: number | null;
    acceptingFriendRequests: boolean;
}

@Table({ tableName: "users" })
class UserModel extends Model<UserInterface> {

    @Column({ type: DataType.STRING, primaryKey: true })
    public readonly username!: string;

    @Column(DataType.STRING)
    public readonly id!: string;

    @Column(DataType.STRING)
    public readonly realName!: string;

    @BelongsToMany(() => UserModel, { through: () => FriendModel, as: "friendsA", foreignKey: "userA", otherKey: "userB" })
    public friendsA!: UserModel[];

    @BelongsToMany(() => UserModel, { through: () => FriendModel, as: "friendsB", foreignKey: "userB", otherKey: "userA" })
    public friendsB!: UserModel[];

    @BelongsToMany(() => UserModel, { through: () => FriendRequestModel, as: "requestedFriends", foreignKey: "senderUsername", otherKey: "receiverUsername" })
    public requestedFriends!: UserModel[];

    @BelongsToMany(() => UserModel, { through: () => FriendRequestModel, as: "friendRequests", foreignKey: "receiverUsername", otherKey: "senderUsername" })
    public friendRequests!: UserModel[];

    @BelongsToMany(() => UserModel, { through: () => BlockedUserModel, as: "blocked", foreignKey: "blocker", otherKey: "blocked" })
    public blocked!: UserModel[];

    @HasMany(() => SubscriptionModel, { as: "subscriptions", foreignKey: "username" })
    public subscriptions!: SubscriptionModel[];

    @Column(DataType.INTEGER)
    public score!: number;

    @Column(DataType.INTEGER)
    public wins!: number;

    @Column({ type: DataType.BIGINT, allowNull: true })
    public lastInvite!: number | null;

    @Column(DataType.BOOLEAN)
    public silent!: boolean;

    @Column(DataType.BOOLEAN)
    public acceptingFriendRequests!: boolean;

    // Timestamps
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    // Friend management

    /**
     * Gets all of the users friends.
     * @returns List of {@link UserModel}s.
     */
    public get friends(): UserModel[] { return [...this.friendsA, ...this.friendsB] }

    /**
     * Creates a friend relation between this user and another, if other user has friend requested this user.
     * @param user The user to friend.
     */
    public friend = (user: UserModel) => {
        if (!this.hasFriend(user) && this.hasBeenRequestedBy(user)) {
            this.unrequest(user)
            user.unrequest(this)
            this.unblock(user)
            user.unblock(this)
            FriendModel.create({ "userA": this.username, "userB": user.username })
        }
    }

    /**
     * Removes a friend relation between this user and another.
     * @param user The user to unfriend.
     */
    public async unfriend(user: UserModel): Promise<void> {
        await this.block(user)
        await FriendModel.destroy({
            where: {
                [Op.or]: [
                    { userA: this.username, userB: user.username },
                    { userA: user.username, userB: this.username }
                ]
            }
        });
    }

    public hasFriend = (user: UserModel): boolean => this.friends.some(friend => friend.username == user.username)

    // User blocking management

    /**
     * Blocks a user.
     * @param user The user to block.
     */
    public block = async (user: UserModel): Promise<void> => {
        if (!this.hasBlocked(user)) {
            await BlockedUserModel.create({ blocker: this.username, blocked: user.username })
        }
    }

    /**
     * Unblocks a user.
     * @param user The user to unblock.
     */
    public unblock = async (user: UserModel): Promise<void> => {
        BlockedUserModel.destroy({ where: { blocker: this.username, blocked: user.username } })
    }

    private hasBlocked = (user: UserModel): boolean => this.blocked.some(blockedUser => blockedUser.username == user.username)

    // Friend Request Managment

    /**
     * Requests to friend a user, if user already been requested, then adds friend.
     * @param user The user to request.
     */
    public request = async (user: UserModel): Promise<void> => {
        if (this.hasBeenRequestedBy(user)) {
            this.friend(user);
        } else if (!this.hasRequested(user) && user.acceptingFriendRequests) {
            FriendRequestModel.create({ senderUsername: this.username, receiverUsername: user.username })
        }
    }

    /**
     * 
     * @param user 
     */
    public unrequest = async (user: UserModel): Promise<void> => {
        FriendRequestModel.destroy({ where: { senderUsername: this.username, receiverUsername: user.username } })
    }

    private hasRequested = (user: UserModel): boolean => this.requestedFriends.some(person => person.username == user.username)
    private hasBeenRequestedBy = (user: UserModel): boolean => user.requestedFriends.some(person => person.username == this.username)

    // Subscription Management

    /**
     * Adds a subscription to this user.
     * @param subscription The {@link SubscriptionInformation}.
     */
    public addSubscription(subscription: SubscriptionInformation) {
        SubscriptionModel.upsert({
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            username: this.username
        })
    }

    private async getSubscriptions(): Promise<SubscriptionInformation[]> {
        const models = await SubscriptionModel.findAll({ where: { username: this.username } })
        let subscriptions: SubscriptionInformation[] = models.map((m) => m.fullSubcription);
        return subscriptions;
    }

    /**
     * Sends notification to this user.
     * @param title Title of the notification.
     * @param body Body of the notificiation.
     * @param applyTimeout Whether or no to use/apply the notification timeout. Defaults to `true`.
     */
    public async notify(title: string, body: string, applyTimeout: boolean = true) {
        if (applyTimeout) {
            if (lastOnline[this.username] && new Date().getTime() - lastOnline[this.username] < 5000) return;
            lastOnline[this.username] = new Date().getTime();
        }
        sendPushNotification(await this.getSubscriptions(), title, body)
    }

    /**
     * Creates a user using identifing fields
     * @param id The users sub.
     * @param username The users username.
     * @param realName The users real name.
     * @returns `true` if user created and `false` if user could not be created. 
     */
    public static async createUser(id: string, username: string, realName: string): Promise<boolean> {
        const user = await this.findOne({ where: { [Op.or]: { username: username, id: id } } })
        if (user) return false;
        UserModel.create({
            id,
            realName,
            username,
            score: 0,
            wins: 0,
            silent: false,
            acceptingFriendRequests: true
        })
        return true;
    }

    /**
     * Gets the first UserModel based on an identifier.
     * @param value The search term.
     * @param identifier Which property of user to use for searching. Defaults to `username`.
     * @returns The {@link UserModel} or `null` if nothing was found.
     */
    public static async getUser(value: string, identifier: keyof UserInterface = "username"): Promise<UserModel | null> {
        return UserModel.findOne({
            where: { [identifier]: value },
            include: [
                { model: UserModel, as: "friendsA" },
                { model: UserModel, as: "friendsB" },
                { model: UserModel, as: "requestedFriends" },
                { model: UserModel, as: "friendRequests"},
                { model: UserModel, as: "blocked" },
                { model: SubscriptionModel, as: "subscriptions" }
            ]
        })
    }
}

export default UserModel;