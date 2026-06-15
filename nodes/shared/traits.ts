export interface TraitEntry {
  key: string;
  value: string | number | boolean;
}

export interface TraitsCollection {
  trait?: TraitEntry[];
}

export interface ApiTrait {
  trait_key: string;
  trait_value: string | number | boolean;
}

export function buildTraits(collection: TraitsCollection): ApiTrait[] {
  const entries = collection.trait ?? [];
  return entries.map((e) => ({ trait_key: e.key, trait_value: e.value }));
}
