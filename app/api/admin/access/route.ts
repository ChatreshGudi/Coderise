import { NextResponse } from 'next/server';
// Existing clients receive an explicit migration response; the shared token grants no access.
export async function POST(){return NextResponse.json({error:'Token access has been retired. Sign in with an administrator account.'},{status:410,headers:{'Cache-Control':'no-store'}});}
