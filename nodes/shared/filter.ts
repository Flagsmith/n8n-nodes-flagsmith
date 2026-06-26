// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function passesFeatureFilter(payload: any, featureNames: string[]): boolean {
  if (!featureNames.length) return true;
  const name = payload?.data?.new_state?.feature?.name;
  if (!name) return false;
  return featureNames.includes(name);
}
