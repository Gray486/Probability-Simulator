import { Sequelize } from 'sequelize-typescript';
import UserModel from './UserModel';
import FriendModel from './FriendModel';
import FriendRequestModel from './FriendRequestModel';
import BlockedUserModel from './BlockedUserModel';
import SubscriptionModel from './SubscriptionModel';

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './storage/database.db', // Path to the SQLite database file
    models: [UserModel, FriendModel, FriendRequestModel, BlockedUserModel, SubscriptionModel],
    logging: false
});

export default sequelize;