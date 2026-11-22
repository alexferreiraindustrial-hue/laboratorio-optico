import {describe,it,expect} from "vitest";
import {expressClock,waitingForFrame,operationsError} from "./operations";
describe("frame and express assembly",()=>{
 it("only separates VTA after lenses arrive",()=>{expect(waitingForFrame({frame_state:"vta"})).toBe(false);expect(waitingForFrame({frame_state:"vta",lens_arrived_at:"2026-11-22T12:00:00Z"})).toBe(true);expect(waitingForFrame({lens_arrived_at:"2026-11-22T12:00:00Z"})).toBe(false);});
 it("keeps legacy orders without a clock and does not start one at entry",()=>{expect(expressClock({},new Date())).toBeNull();expect(expressClock({express_minutes:20},new Date())?.tone).toBe("waiting");});
 it("derives the same remaining time after reload from the saved start",()=>{const order={express_minutes:40,express_started_at:"2026-11-22T12:00:00Z"};expect(expressClock(order,new Date("2026-11-22T12:35:00Z"))?.label).toContain("5:00");expect(expressClock({...order},new Date("2026-11-22T12:41:05Z"))?.label).toContain("1:05 em atraso");});
 it("freezes the time on assembly completion",()=>{const order={express_minutes:20,express_started_at:"2026-11-22T12:00:00Z",express_finished_at:"2026-11-22T12:18:00Z"};expect(expressClock(order,new Date("2026-11-23T12:00:00Z"))?.remaining).toBe(120000);});
 it("rejects unsupported durations or frame states",()=>{for(const minutes of [0,10,30,45,90,NaN])expect(operationsError("present",minutes)).not.toBeNull();expect(operationsError("missing",40)).not.toBeNull();expect(operationsError("unknown",null)).toBeNull();});
});
