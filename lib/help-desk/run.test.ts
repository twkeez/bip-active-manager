import { describe, expect, it } from "vitest";
import { fixesFromUnmatchedTab } from "@/lib/help-desk/run";
import {
  UNMATCHED_APPROVE_HEADER,
  UNMATCHED_ASSIGN_HEADER,
  UNMATCHED_EMAIL_HEADER,
  UNMATCHED_SUGGESTED_HEADER,
} from "@/lib/help-desk/report";

const header = [UNMATCHED_EMAIL_HEADER, "Requester", UNMATCHED_SUGGESTED_HEADER, "Confidence", UNMATCHED_APPROVE_HEADER, UNMATCHED_ASSIGN_HEADER];

describe("fixesFromUnmatchedTab", () => {
  it("takes approved guesses and hand-typed names, and nothing else", () => {
    const fixes = fixesFromUnmatchedTab([
      header,
      ["QuitmanAnimalClinic@gmail.com", "Front desk", "Quitman Animal Clinic", "High", "y", ""],
      ["guess@yahoo.com", "Someone", "Happy Paws Vet", "Low", "", ""],
      ["typed@aol.com", "Ann", "Wrong Guess Vet", "Medium", "Y", "Oak Creek Clinic"],
      ["spam@example.org", "Spam", "", "", "", "IGNORE"],
      ["", "No email", "Happy Paws Vet", "High", "Y", ""],
    ]);
    expect([...fixes]).toEqual([
      ["quitmananimalclinic@gmail.com", "Quitman Animal Clinic"],
      ["typed@aol.com", "Oak Creek Clinic"],
      ["spam@example.org", "IGNORE"],
    ]);
  });

  it("still reads a tab written before the approve column existed", () => {
    const fixes = fixesFromUnmatchedTab([
      [UNMATCHED_EMAIL_HEADER, "Requester", UNMATCHED_ASSIGN_HEADER],
      ["a@gmail.com", "A", "Quitman Animal Clinic"],
    ]);
    expect([...fixes]).toEqual([["a@gmail.com", "Quitman Animal Clinic"]]);
  });
});
