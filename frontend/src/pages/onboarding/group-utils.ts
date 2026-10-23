/**
 * Small helpers for the group screens.
 */
import { GroupPerson } from "./api";

/** "Robin, Priya and 2 others" */
export const peopleLine = (people: GroupPerson[]) => {
  const firstNames: string[] = [];
  for (const person of people) {
    const name = person.full_name || person.user;
    firstNames.push(name.split(" ")[0]);
  }

  if (firstNames.length <= 3) {
    return firstNames.join(", ");
  }
  const othersCount = firstNames.length - 2;
  return `${firstNames[0]}, ${firstNames[1]} and ${othersCount} others`;
};
