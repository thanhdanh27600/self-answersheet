import {POCKETBASE_URL} from "@/utils/constants";
import PocketBase from "pocketbase";

const pb = new PocketBase(POCKETBASE_URL);

export {pb};
