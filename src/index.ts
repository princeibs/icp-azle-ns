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
$update;
export function registerName(_name: string): Result<string, string> {
  const name = _name.trim();

  // Check if the name is valid (only contains letters and numbers)
  if (!isNameValid(name)) {
    return Result.Err<string, string>(
      " INVALID_NAME_FORMAT : Name can only contain letters and numbers from the English alphabet"
    );
  }
  // Check the length of the name
  if (name.length < 2 || name.length > 16) {
    return Result.Err<string, string>(
      " INVALID_NAME_LENGTH : Name must be between 2 and 16 characters long"
    );
  }

  // Check if the name is already registered
  return match(register.get(name), {
    Some: () =>
      Result.Err<string, string>(
        `${name} is already taken. Please use another name`
      ),
    None: () => {
      // If the name is not registered, insert it into the "register" map with the caller's Principal
      register.insert(name, ic.caller());
      return Result.Ok<string, string>(
        `${name} now maps to ${ic.caller().toString()}`
      );
    },
  });
}

// Update function to set additional data (btcAddress, ethAddress, twitterUsername) for a registered name
$update;
export function setNameData(
  name: string,
  _btcAddress: string,
  _ethAddress: string,
  _twitterUsername: string
): Result<string, string> {
  const btcAddress = _btcAddress.trim();
  const ethAddress = _ethAddress.trim();
  const twitterUsername = _twitterUsername.trim();

  // Check if the caller is the owner of the name
  return match(register.get(name), {
    Some: (owner) => {
      if (ic.caller().toString() !== owner.toString()) {
        return Result.Err<string, string>("Only name owner can set name data");
      }

      // Check if the name already has associated data
      if (records.containsKey(name)) {
        return Result.Err<string, string>(
          `${name} already has data associated with it`
        );
      }

      // Check the validity of the provided data (btcAddress, ethAddress, twitterUsername)
      if (btcAddress.length === 0) {
        return Result.Err<string, string>("Invalid Bitcoin address");
      }
      if (ethAddress.length === 0) {
        return Result.Err<string, string>("Invalid Ethereum address");
      }
      if (twitterUsername.length == 0) {
        return Result.Err<string, string>("Invalid Twitter username");
      }

      // Create a Name object with the provided data and insert it into the "records" map
      const nameData: Name = {
        btcAddress,
        ethAddress,
        twitterUsername,
      };
      records.insert(name, nameData);
      return Result.Ok<string, string>(
        `${name} now maps to ${JSON.stringify(nameData)}`
      );
    },
    None: () => Result.Err<string, string>(`${name} has not been claimed yet`),
  });
}

// Update function to update additional data (btcAddress, ethAddress, twitterUsername) for a registered name
$update;
export function updateNameData(
  name: string,
  _btcAddress: string,
  _ethAddress: string,
  _twitterUsername: string
): Result<string, string> {
  // Validate input parameters
  if (!name || !name.trim()) {
    return Result.Err<string, string>("Invalid name");
  }
  if (!_btcAddress || !_btcAddress.trim()) {
    return Result.Err<string, string>("Invalid Bitcoin address");
  }
  if (!_ethAddress || !_ethAddress.trim()) {
    return Result.Err<string, string>("Invalid Ethereum address");
  }
  if (!_twitterUsername || !_twitterUsername.trim()) {
    return Result.Err<string, string>("Invalid Twitter username");
  }

  const btcAddress = _btcAddress.trim();
  const ethAddress = _ethAddress.trim();
  const twitterUsername = _twitterUsername.trim();

  // Check if the caller is the owner of the name
  return match(register.get(name), {
    Some: (val) => {
      if (ic.caller().toString() !== val.toString()) {
        return Result.Err<string, string>(
          `Only name owner can update name data`
        );
      }

      // Check the validity of the provided data (btcAddress, ethAddress, twitterUsername)
      if (btcAddress.length === 0) {
        return Result.Err<string, string>("Invalid Bitcoin address");
      }
      if (ethAddress.length === 0) {
        return Result.Err<string, string>("Invalid Ethereum address");
      }
      if (twitterUsername.length === 0) {
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
        `${name} data has now been updated from ${JSON.stringify(
          prevData.Some || {}
        )} to ${JSON.stringify(nameData)}`
      );
    },
    None: () => Result.Err<string, string>(`${name} has not been claimed yet`),
  });
}

// Update function to clear a registered name and its associated data
$update;
export function clearName(name: string): Result<string, string> {
  return match(register.get(name), {
    Some: (nameOwner) => {
      if (ic.caller().toString() !== nameOwner.toString()) {
        return Result.Err<string, string>(
          "Only name owner can clear name. Aborting..."
        );
      }

      // Check if the name has associated data, if not, log a message and proceed
      if (!records.containsKey(name)) {
        console.log(
          `'${name}' has been claimed but has no data attached to it. Proceeding to clear name...`
        );
      }

      // Remove the name and its associated data from the respective maps
      register.remove(name);
      const prevData = records.remove(name);

      return Result.Ok<string, string>(
        `'${name}' with data: ${JSON.stringify(
          prevData
        )} has been cleared from storage`
      );
    },
    None: () =>
      Result.Err<string, string>(`Cannot clear name that has not been claimed`),
  });
}

// Query function to view all registered names
$query;
/**
 * Returns a list of all registered names.
 * @returns A Result containing a Vec of strings on success, or an error message on failure.
 */
export function viewAllNames(): Result<Vec<string>, string> {
  const keys: Vec<string> = register.keys();
  if (keys.length === 0) {
    return Result.Err("No names found.");
  }
  return Result.Ok(keys);
}

// Query function to view the data associated with a registered name
$query;
export function viewNameData(name: string): Result<Name, string> {
  try {
    if (isNameAvailable(name)) {
      return Result.Err<Name, string>(`${name} has not been claimed yet`);
    }

    if (!records.containsKey(name)) {
      return Result.Err<Name, string>(`${name} has no data associated with it`);
    }

    return getNameData(name);
  } catch (e) {
    console.error(`Error getting name data: ${e}`);
    return Result.Err<Name, string>(`Error getting name data: ${e}`);
  }
}

function getNameData(name: string): Result<Name, string> {
  return match(records.get(name), {
    Some: (nameData) => {
      return Result.Ok<Name, string>(nameData);
    },
    None: (e) =>
      Result.Err<Name, string>(`Error getting name data for ${name}: ${e}`),
  });
}

$query;
/**
 * Returns the Principal associated with the given name.
 * @param name - The name to look up.
 * @returns A Result containing either the Principal as a string or an error message.
 */
export function viewRegisteredName(name: string): Result<string, string> {
  return match(register.get(name), {
    Some: (val) => Result.Ok<string, string>(val.toString()),
    None: () =>
      Result.Err<string, string>(
        `The name ${name} has not been registered yet`
      ),
  });
}

// Query function to check if a name is available (not registered)
function isNameAvailable(name: string): boolean {
  try {
    return match(register.get(name), {
      Some: () => false,
      None: () => true,
    });
  } catch (e) {
    console.error(`Error getting name availability: ${e}`);
    return false;
  }
}

// Regular expression to match only letters and numbers
const validNameRegex = /^[A-Za-z0-9]+$/;

// Function to check if a name contains only letters and numbers
function isNameValid(str: string): Result<string, string> {
  // Test the input string against the regex and return the result
  if (validNameRegex.test(str)) {
    return Result.Ok<string, string>(str);
  } else {
    return Result.Err<string, string>(
      "INVALID_NAME_FORMAT: Name can only contain letters and numbers from the English alphabet"
    );
  }
}
