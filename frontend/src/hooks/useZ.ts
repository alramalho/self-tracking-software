import { createUseZero } from "@rocicorp/zero/react";
import { Schema } from "@/zero/index";
import { Mutators } from "@/zero/mutators";

export const useZ = createUseZero<Schema, Mutators>();
