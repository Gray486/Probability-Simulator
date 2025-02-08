import { userInfo } from "os";
import { ANSIColorCodes, colorLog } from "../utils";
import BlockedUserModel from "./BlockedUserModel";
import FriendModel from "./FriendModel";
import syncDatabase from "./syncDatabase";
import UserModel from "./UserModel";


(async () => {
    await syncDatabase()

    await UserModel.createUser("0", "Gray0", "Gray")
    await UserModel.createUser("1", "Gray1", "Gray")

    let user0 = await UserModel.getUser("Gray0")
    let user1 = await UserModel.getUser("Gray1");

    colorLog(user0, ANSIColorCodes.BrightYellow)

    if (!user0 || !user1) return;

    await FriendModel.create({ userA: user1.username, userB: user0.username })
    await BlockedUserModel.create({ blocker: user0.username, blocked: user1.username })

    user0.addSubscription({
        expirationTime: 2,
        endpoint: "a",
        keys: {
            p256dh: "b",
            auth: "c"
        }
    })

    user0 = await UserModel.getUser("Gray0")

    if (!user0) return;

    colorLog(JSON.stringify(user0.friends), ANSIColorCodes.Cyan)
})()