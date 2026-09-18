import { it, expect } from "vitest";
import { rankPeople } from "./rank";
const people=[{username:"liocas",name:"Lia Borges"},{username:"liaborges1",name:"Lia Borges"},{username:"barbara",name:"Bárbara Herbert"},{username:"alex",name:"Alex"}];
it("finds Lia by display name and ranks exact usernames above approximate matches",()=>{
 expect(rankPeople(people,"LIA").map(p=>p.username)).toContain("liocas");
 expect(rankPeople(people,"@liocas")[0].username).toBe("liocas");
 expect(rankPeople(people,"liocsa")[0].username).toBe("liocas");
});
it("normalizes accents, handles prefixes and does not suggest unrelated people",()=>{
 expect(rankPeople(people,"barbara")[0].name).toBe("Bárbara Herbert");
 expect(rankPeople(people,"li")).toHaveLength(2);
 expect(rankPeople(people,"zzzzzz")).toEqual([]);
 expect(rankPeople(people,"",2)).toHaveLength(2);
});
it("puts the most active people first when browsing and uses recency for ties",()=>{
 const activePeople = [
  {username:"quiet",name:"Quiet",activityCount:2,lastActivityAt:"2026-09-16T08:00:00Z"},
  {username:"active-old",name:"Active",activityCount:12,lastActivityAt:"2026-09-10T08:00:00Z"},
  {username:"active-new",name:"Active",activityCount:12,lastActivityAt:"2026-09-15T08:00:00Z"},
  {username:"new",name:"New",activityCount:0,lastActivityAt:null},
 ];
 expect(rankPeople(activePeople,"").map(person=>person.username)).toEqual(["active-new","active-old","quiet","new"]);
});
it("keeps search relevance ahead of activity and uses activity for equal matches",()=>{
 const activePeople = [
  {username:"lia-exact",name:"Lia",activityCount:1},
  {username:"lia-active",name:"Lia",activityCount:20},
  {username:"someone",name:"Liana",activityCount:500},
 ];
 expect(rankPeople(activePeople,"lia").map(person=>person.username)).toEqual(["lia-active","lia-exact","someone"]);
 expect(rankPeople(activePeople,"lia-exact")[0].username).toBe("lia-exact");
});
