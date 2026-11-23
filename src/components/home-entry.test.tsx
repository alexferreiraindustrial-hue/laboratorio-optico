import {beforeEach,describe,expect,it,vi} from "vitest";
import type {AppRole} from "@/lib/domain/constants";
const mocks=vi.hoisted(()=>({requireProfile:vi.fn(),from:vi.fn()}));
vi.mock("@/server/session",()=>({requireProfile:mocks.requireProfile}));
vi.mock("@/components/production-dashboard",()=>({default:function ProductionDashboard(){return null;}}));
import InicioPage from "@/app/(painel)/inicio/page";
import ProductionDashboard from "@/components/production-dashboard";

beforeEach(()=>{
 vi.clearAllMocks();
 mocks.from.mockImplementation(()=>{
  const result={count:0,error:null};
  const promise=Promise.resolve(result);
  const builder={select:vi.fn(),eq:vi.fn(),in:vi.fn(),lt:vi.fn(),then:promise.then.bind(promise)};
  for(const method of [builder.select,builder.eq,builder.in,builder.lt]) method.mockReturnValue(builder);
  return builder;
 });
});
function session(role:AppRole){return {role,profile:{id:"demo",full_name:"Pessoa de teste",role,active:true},supabase:{from:mocks.from}};}

describe("Home entry after the Oficina de Luz redesign",()=>{
 for(const role of ["admin","gestor","consulta"] as const)it(`shows the production overview directly at /inicio for ${role}`,async()=>{
  const context=session(role);mocks.requireProfile.mockResolvedValue(context);
  const page=await InicioPage();
  expect(page.type).toBe(ProductionDashboard);
  expect(page.props).toMatchObject({session:context});
  expect(mocks.from).not.toHaveBeenCalled();
 });
 it("forwards period and laboratory filters when the overview opens at /inicio",async()=>{
  mocks.requireProfile.mockResolvedValue(session("admin"));
  const filters={period:"periodo",from:"2026-11-01",to:"2026-11-22",laboratory:"lab-demo"};
  const page=await InicioPage({searchParams:Promise.resolve(filters)});
  expect(await page.props.searchParams).toEqual(filters);
 });
 for(const role of ["montador","estoquista"] as const)it(`preserves quick operational entry for ${role}`,async()=>{
  mocks.requireProfile.mockResolvedValue(session(role));
  const page=await InicioPage();
  expect(page.type).not.toBe(ProductionDashboard);
  expect(mocks.from).toHaveBeenCalledTimes(5);
 });
});
