// Import necessary modules and types from "azle" library
import {
    $query,
    $update,
    Record,
    StableBTreeMap,
    Vec,
    match,
    Result,
    ic,
    Principal,
} from "azle";

// Define the Name type as a Record containing btcAddress, ethAddress, and twitterUsername fields
type Name = Record<{
    btcAddress: string;
    ethAddress: string;
    twitterUsername: string;
}>;

// Create a StableBTreeMap called "register" to map name (string) to Principal (account identifier)
// This map is used to keep track of the owner of each registered name
const register = new StableBTreeMap<string, Principal>(0, 64, 1024);

// Create a StableBTreeMap called "records" to map name (string) to Name data
// This map is used to store additional data associated with each registered name
const records = new StableBTreeMap<string, Name>(1, 64, 1024);

// Update function to register a new name and associate it with the caller's Principal
$update
export function registerName(_name: string): Result<string, string> {
    const name = _name.trim();

    // Check if the name is valid (only contains letters and numbers)
    if (!isNameValid(name)) {
        return Result.Err<string, string>(
            "Name can only contain letters and numbers from the English alphabet"
        );
    }
    // Check the length of the name
    if (name.length < 2 || name.length > 16) {
        return Result.Err<string, string>("Name must be between 2 and 16 characters long");
    }

    // Check if the name is already registered
    return match(register.get(name), {
        Some: () => Result.Err<string, string>(`${name} is already taken. Please use another name`),
        None: () => {
            // If the name is not registered, insert it into the "register" map with the caller's Principal
            register.insert(name, ic.caller());
            return Result.Ok<string, string>(`${name} now maps to ${ic.caller().toString()}`);
        }
    });
}

// Update function to set additional data (btcAddress, ethAddress, twitterUsername) for a registered name
$update
export function setNameData(name: string, _btcAddress: string, _ethAddress: string, _twitterUsername: string): Result<string, string> {
    const btcAddress = _btcAddress.trim();
    const ethAddress = _ethAddress.trim();
    const twitterUsername = _twitterUsername.trim();

    // Check if the caller is the owner of the name
    return match(register.get(name), {
        Some: (owner: Principal) => {
            if (ic.caller().toString() !== owner.toString()) {
                return Result.Err<string, string>("Only name owner can set name data");
            }

            // Check if the name already has associated data
            if (records.containsKey(name)) {
                return Result.Err<string, string>(`${name} already has data associated with it`);
            }

            // Check the validity of the provided data (btcAddress, ethAddress, twitterUsername)
            if (btcAddress.length === 0 || btcAddress.length > 100) {
                return Result.Err<string, string>("Invalid Bitcoin address");
            }
            if (ethAddress.length === 0 || ethAddress.length > 100) {
                return Result.Err<string, string>("Invalid Ethereum address");
            }
            if (twitterUsername.length === 0 || twitterUsername.length > 100) {
                return Result.Err<string, string>("Invalid Twitter username");
            }

            // Create a Name object with the provided data and insert it into the "records" map
            const nameData: Name = {
                btcAddress,
                ethAddress,
                twitterUsername,
            };
            records.insert(name, nameData);
            return Result.Ok<string, string>(`${name} now maps to ${JSON.stringify(nameData)}`);
        },
        None: () => Result.Err<string, string>(`${name} has not been claimed yet`),
    });
}

// Update function to update additional data (btcAddress, ethAddress, twitterUsername) for a registered name
$update
export function updateNameData(name: string, _btcAddress: string, _ethAddress: string, _twitterUsername: string): Result<string, string> {
    const btcAddress = _btcAddress.trim();
    const ethAddress = _ethAddress.trim();
    const twitterUsername = _twitterUsername.trim();

    // Check if the caller is the owner of the name
    return match(register.get(name), {
        Some: (owner: Principal) => {
            if (ic.caller().toString() !== owner.toString()) {
                return Result.Err<string, string>(`Only name owner can update name data`);
            }

            // Check the validity of the provided data (btcAddress, ethAddress, twitterUsername)
            if (btcAddress.length === 0 || btcAddress.length > 100) {
                return Result.Err<string, string>("Invalid Bitcoin address");
            }
            if (ethAddress.length === 0 || ethAddress.length > 100) {
                return Result.Err<string, string>("Invalid Ethereum address");
            }
            if (twitterUsername.length === 0 || twitterUsername.length > 100) {
                return Result.Err<string, string>("Invalid Twitter username");
            }

            // Create a Name object with the updated data and insert it into the "records" map
            const nameData: Name = {
                btcAddress,
                ethAddress,
                twitterUsername,
            };
            const prevData = records.get(name);
            records.insert(name, nameData);
            return Result.Ok<string, string>(
                `${name} data has now been updated from ${JSON.stringify(prevData?.Some || {})} to ${JSON.stringify(nameData)}`
            );
        },
        None: () => Result.Err<string, string>(`${name} has not been claimed yet`),
    });
}

// ... (other functions remain unchanged)
