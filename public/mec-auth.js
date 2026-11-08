(function(){
 const cfg=window.MEC_CONFIG||{};
 const client=window.supabase?.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 window.MEC_AUTH={
  getSession:async()=>{if(!client)return null;const {data,error}=await client.auth.getSession();if(error)throw error;return data.session;},
  signOut:async()=>{if(!client)return;const {error}=await client.auth.signOut();if(error)throw error;}
 };
})();