import {getDb,DomainError} from "../src/lib/db";
import {reserveShopOrder} from "../src/lib/shop";
import {basename,dirname,resolve} from "node:path";
import {tmpdir} from "node:os";
async function main() {
 const path=resolve(process.argv[2]||"");
 const directory=dirname(path);
 if(dirname(directory)!==resolve(tmpdir())||!basename(directory).startsWith("tibb-commerce-tests-")||basename(path)!=="shop.sqlite") throw new Error("Worker requires its isolated fixture");
 for(const key of ["TURSO_DATABASE_URL","TURSO_AUTH_TOKEN","VERCEL"])delete process.env[key];
 process.env.TIBB_DATABASE_PATH=path;
 try {await reserveShopOrder({items:[{productId:Number(process.argv[3]),quantity:1}],name:"Isolated process fixture",email:"worker@example.test",phone:"",delivery:"pickup",couponCode:"LASTUSE",consent:true});process.stdout.write("ok");}catch(error){if(error instanceof DomainError)process.stdout.write("unavailable");else throw error;}finally{await getDb().close();}
}
main().catch(()=>{process.stderr.write("Isolated commerce worker failed");process.exitCode=1;});
