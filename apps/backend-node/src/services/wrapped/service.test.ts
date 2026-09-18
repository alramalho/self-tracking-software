import { it, expect, vi } from "vitest";
import { getWrappedLeaderboard } from "./service";
import type { WrappedDatabase } from "./types";
it("aggregates the complete year for self and accepted friends without loading capped profiles", async () => {
  const lia={id:"lia",username:"liocas",name:"Lia Borges",picture:null};
  const db={
    user:{findUnique:vi.fn().mockResolvedValue({id:"alex",username:"alex",name:"Alex",picture:null,connectionsFrom:[{to:lia}],connectionsTo:[{from:lia}]})},
    activityEntry:{groupBy:vi.fn().mockResolvedValue([{userId:"lia",_count:{_all:345}}])},
    plan:{findMany:vi.fn().mockResolvedValue([
      {id:"finished",userId:"lia",progressState:{lifestyleAchievement:{achievedAt:"2025-11-07"}}},
      {id:"archived",userId:"lia",progressState:{habitAchievement:{isAchieved:false,achievedAt:"2025-12-03"}}},
      {id:"future",userId:"lia",progressState:{lifestyleAchievement:{achievedAt:"2026-01-01"}}},
    ])},
  };
  const result=await getWrappedLeaderboard(db as unknown as WrappedDatabase,"alex",2025);
  expect(result.people).toHaveLength(2);
  expect(result.people.find(p=>p.id==="lia")).toMatchObject({totalActivitiesLogged:345,habitCount:1,lifestyleCount:1,totalPoints:470});
  expect(result.people.find(p=>p.id==="alex")?.totalPoints).toBe(0);
  expect(db.activityEntry.groupBy.mock.calls[0][0].where).toEqual({userId:{in:["alex","lia"]},deletedAt:null,activityId:{not:null},activity:{deletedAt:null},datetime:{gte:new Date("2025-01-01Z"),lt:new Date("2026-01-01Z")}});
  const select=db.user.findUnique.mock.calls[0][0].select;
  expect(select.connectionsFrom.where).toEqual({status:"ACCEPTED",to:{deletedAt:null}});
  expect(select.connectionsTo.where).toEqual({status:"ACCEPTED",from:{deletedAt:null}});
  expect(db.plan.findMany.mock.calls[0][0].where).not.toHaveProperty("archivedAt");
});
