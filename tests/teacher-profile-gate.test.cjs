const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = p => fs.readFileSync(path.resolve(__dirname,"..",p),"utf8");

test("home teacher images and names link to a detail page and membership notice",()=>{
  const source=read("components/HomeTeachers.tsx");
  assert.match(source, /href=\{"\/teachers\/" \+ teacher\.user_id\}/);
  assert.match(source,/회원가입 시 해당 강사들에 대한 상세한 정보를 확인하실 수 있어요/);
  assert.match(source,/href="\/signup"/);
  const home=read("app/page.tsx");
  assert.match(home,/전체 강사진 보기 \(회원 전용\)/);
});
test("public teacher directory and detail require registered membership before any DB read",()=>{
  const gate=read("lib/teacher-directory-access.ts");
  const listing=read("app/teachers/page.tsx");
  const detail=read("app/teachers/[id]/page.tsx");
  assert.match(gate,/supabase\.auth\.getUser\(\)/);
  assert.match(gate,/\.from\("profiles"\)\.select\("role"\)/);
  assert.match(gate,/\/signup\?next=/);
  assert.match(listing,/await requireTeacherDirectoryMember\("\/teachers"\)/);
  assert.ok(listing.indexOf("await requireTeacherDirectoryMember(")<listing.indexOf("await listPublicTeachers("));
  assert.match(detail,/await requireTeacherDirectoryMember\("\/teachers\/" \+ encodeURIComponent\(id\)\)/);
  assert.ok(detail.indexOf("await requireTeacherDirectoryMember(")<detail.indexOf("await getPublicTeacherProfile(id)"));
  assert.match(listing,/robots: \{ index: false, follow: false \}/);
  assert.match(detail,/robots: \{ index: false, follow: false \}/);
  assert.doesNotMatch(detail,/description: teacher\.bio/);
});
test("member profiles expose only approved profile fields and obey homepage publication settings",()=>{
  const src=read("lib/public-teachers.ts");
  assert.match(src,/\.eq\("is_active", true\)/);
  assert.match(src,/\.eq\("show_on_homepage", true\)/);
  assert.match(src,/\.select\("user_id,display_name,nationality,bio,specialties,years_experience,education,certifications"\)/);
  assert.match(src,/\.select\("name,profile_image_url"\)/);
  assert.doesNotMatch(src,/select\([^)]*(?:hourly_rate|phone|email|birth_date|payment|child_id)/);
  assert.match(src,/UUID_PATTERN\.test\(id\)/);
});
test("existing members continue to requested teacher profile after signing in",()=>{
  const login=read("app/login/page.tsx");
  const signup=read("app/signup/page.tsx");
  assert.match(login,/\/teachers\(\?:\\\/\[a-f0-9-\]\{36\}\)\?\$/);
  assert.match(login,/window\.location\.assign\(safeNextPath\)/);
  assert.match(signup,/getSafeNextPath\(nextParam\)/);
  assert.match(signup,/router\.replace\(loginHref\)/);
});

test("existing public teacher-list RPC must use authenticated server user, not service_role",()=>{
  const src=read("lib/public-teachers.ts");
  const first=src.indexOf("export const listPublicTeachers");
  const next=src.indexOf("export const getPublicTeacherProfile");
  assert.ok(first >= 0 && next > first);
  const listing=src.slice(first,next);
  assert.match(src,/import \{ createClient \} from "@\/lib\/supabase-server"/);
  assert.match(listing,/const db = await createClient\(\)/);
  assert.match(listing,/db\.rpc\("get_public_teachers"\)/);
  assert.doesNotMatch(listing,/createAdminClient\(\)/);
  assert.match(read("app/teachers/page.tsx"),/await requireTeacherDirectoryMember\("\/teachers"\)/);
  assert.match(read("lib/teacher-directory-access.ts"),/supabase\.auth\.getUser\(\)/);
  // The detail query remains separately authorized by the member-only page.
  const detail=src.slice(next);
  assert.match(detail,/const db = createAdminClient\(\)/);
  assert.match(detail,/\.eq\("is_active", true\)/);
  assert.match(detail,/\.eq\("show_on_homepage", true\)/);
});
