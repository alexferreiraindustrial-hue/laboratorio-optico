import {it,expect} from "vitest";
import {sellerFilterNames} from "./seller-filters";
it("shows new active Amanda without orders and retains inactive historical assignments",()=>{expect(sellerFilterNames([{name:"Vendedora nova",active:true},{name:"Desativada sem serviços",active:false}], ["Antiga",null,"Vendedora nova"])).toEqual(["Antiga","Sem vendedora","Vendedora nova"]);expect(sellerFilterNames([{name:"Vendedora nova",active:true}],[])).toEqual(["Vendedora nova"]);});
