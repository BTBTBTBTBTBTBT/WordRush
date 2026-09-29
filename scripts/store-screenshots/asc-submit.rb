require "jwt"; require "json"; require "net/http"; require "openssl"
# Submit iOS VER (BUILD) to App Review — env VER / BUILD / DRY=1; edit WHATS_NEW per release with AUTOMATIC release, through the App
# Store Connect API (the ASC browser session expired). Idempotent: every step
# looks before it writes. Same key the ship script uses; the .p8 is read from
# disk and never printed.
APP = "6775966055"; VERSION = ENV.fetch("VER", "2.3"); BUILD = ENV.fetch("BUILD", "204")
WHATS_NEW = <<~TXT.strip
  • Starsweep: tap for a black star, double-tap to play it — purple when right, red when wrong. A red or erased star takes its crosses with it, and a red star no longer stops the board from finishing.
  • Completed today now shows your finished puzzle for every More Games title.
  • Today's Games groups your Unlimited games into one row per game.
  • Game clocks stop while you're away from the app.
  • Faster: smoother Stats and Leaderboard, quicker first opens, cached images.
  • Muddle's caption always shows in full.
TXT
kid = "C8FRS9T697"; iss = "8bdd3f73-0d8b-427d-95c7-8097b77dfb7a"
p8 = File.join(Dir.home, ".appstoreconnect/private_keys/AuthKey_#{kid}.p8")
def token(kid, iss, p8)
  JWT.encode({ iss: iss, exp: Time.now.to_i + 900, aud: "appstoreconnect-v1" }, OpenSSL::PKey::EC.new(File.read(p8)), "ES256", { kid: kid, typ: "JWT" })
end
TOK = token(kid, iss, p8)
def call(method, path, body = nil)
  uri = URI("https://api.appstoreconnect.apple.com#{path}")
  r = { "GET" => Net::HTTP::Get, "POST" => Net::HTTP::Post, "PATCH" => Net::HTTP::Patch }[method].new(uri)
  r["Authorization"] = "Bearer #{TOK}"; r["Content-Type"] = "application/json"
  r.body = JSON.generate(body) if body
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(r) }
  data = res.body.to_s.empty? ? {} : JSON.parse(res.body)
  unless res.code.to_i.between?(200, 299)
    puts "#{method} #{path} -> #{res.code}"; puts JSON.pretty_generate(data)[0, 1500]; exit 1
  end
  data
end

# 1. App Store version 2.2 (create with AFTER_APPROVAL if missing; else make sure releaseType is AFTER_APPROVAL)
vers = call("GET", "/v1/apps/#{APP}/appStoreVersions?filter[versionString]=#{VERSION}&filter[platform]=IOS&fields[appStoreVersions]=versionString,appStoreState,releaseType")["data"]
if vers.empty?
  v = call("POST", "/v1/appStoreVersions", { data: { type: "appStoreVersions", attributes: { platform: "IOS", versionString: VERSION, releaseType: "AFTER_APPROVAL" }, relationships: { app: { data: { type: "apps", id: APP } } } } })["data"]
  puts "created version #{VERSION} (#{v["id"]}) releaseType=AFTER_APPROVAL"
else
  v = vers.first
  puts "version #{VERSION} exists: #{v["attributes"]["appStoreState"]} releaseType=#{v["attributes"]["releaseType"]}"
  if v["attributes"]["releaseType"] != "AFTER_APPROVAL"
    call("PATCH", "/v1/appStoreVersions/#{v["id"]}", { data: { type: "appStoreVersions", id: v["id"], attributes: { releaseType: "AFTER_APPROVAL" } } })
    puts "  releaseType -> AFTER_APPROVAL"
  end
end
VID = v["id"]
state = v["attributes"]["appStoreState"]
if %w[WAITING_FOR_REVIEW IN_REVIEW PENDING_DEVELOPER_RELEASE READY_FOR_SALE].include?(state)
  puts "version already #{state}; nothing to submit"; exit 0
end

# 2. Build 198: wait for processing
build = nil
40.times do |i|
  bs = call("GET", "/v1/builds?filter[app]=#{APP}&filter[version]=#{BUILD}&filter[preReleaseVersion.version]=#{VERSION}&fields[builds]=version,processingState,uploadedDate&limit=5")["data"]
  build = bs.find { |b| b["attributes"]["processingState"] == "VALID" }
  break if build
  puts "build #{BUILD}: #{bs.map { |b| b["attributes"]["processingState"] }.inspect} — waiting (#{i + 1})"
  sleep 30
end
abort("build #{BUILD} not VALID yet") unless build
puts "build #{BUILD} VALID (#{build["id"]})"

# 3. Attach the build
cur = call("GET", "/v1/appStoreVersions/#{VID}/relationships/build")["data"]
if cur.nil? || cur["id"] != build["id"]
  call("PATCH", "/v1/appStoreVersions/#{VID}/relationships/build", { data: { type: "builds", id: build["id"] } })
  puts "attached build #{BUILD}"
else
  puts "build already attached"
end

# 4. What's New on every localization
locs = call("GET", "/v1/appStoreVersions/#{VID}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,whatsNew")["data"]
if locs.empty?
  call("POST", "/v1/appStoreVersionLocalizations", { data: { type: "appStoreVersionLocalizations", attributes: { locale: "en-US", whatsNew: WHATS_NEW }, relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: VID } } } } })
  puts "created en-US localization with What's New"
else
  locs.each do |l|
    call("PATCH", "/v1/appStoreVersionLocalizations/#{l["id"]}", { data: { type: "appStoreVersionLocalizations", id: l["id"], attributes: { whatsNew: WHATS_NEW } } })
    puts "What's New set for #{l["attributes"]["locale"]}"
  end
end

# 4b. Listing text (LISTING=1): description, keywords and promotional text from listing-copy.py.
if ENV["LISTING"] == "1"
  copy = JSON.parse(`python3 -c 'import json,sys; sys.path.insert(0, "#{__dir__}"); import importlib; m = importlib.import_module("listing-copy"); print(json.dumps({"d": m.IOS_DESC, "k": m.KEYWORDS, "p": m.PROMO}))'`)
  call("GET", "/v1/appStoreVersions/#{VID}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale")["data"].each do |l|
    next unless l["attributes"]["locale"] == "en-US"
    call("PATCH", "/v1/appStoreVersionLocalizations/#{l["id"]}", { data: { type: "appStoreVersionLocalizations", id: l["id"], attributes: { description: copy["d"], keywords: copy["k"], promotionalText: copy["p"] } } })
    back = call("GET", "/v1/appStoreVersionLocalizations/#{l["id"]}")["data"]["attributes"]
    puts "listing text set: description #{back["description"].to_s.length} chars, keywords #{back["keywords"].inspect}"
  end
end

# 5. Review submission: reuse an open one or create, add the version item, submit
subs = call("GET", "/v1/reviewSubmissions?filter[app]=#{APP}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES&fields[reviewSubmissions]=state,platform")["data"]
sub = subs.find { |s| s["attributes"]["platform"] == "IOS" }
if sub
  puts "review submission exists: #{sub["attributes"]["state"]} (#{sub["id"]})"
  exit 0 unless sub["attributes"]["state"] == "READY_FOR_REVIEW"
else
  sub = call("POST", "/v1/reviewSubmissions", { data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: { data: { type: "apps", id: APP } } } } })["data"]
  puts "created review submission #{sub["id"]}"
end
items = call("GET", "/v1/reviewSubmissions/#{sub["id"]}/items?fields[reviewSubmissionItems]=state")["data"]
if items.empty?
  call("POST", "/v1/reviewSubmissionItems", { data: { type: "reviewSubmissionItems", relationships: { reviewSubmission: { data: { type: "reviewSubmissions", id: sub["id"] } }, appStoreVersion: { data: { type: "appStoreVersions", id: VID } } } } })
  puts "added version #{VERSION} to the submission"
end
if ENV["DRY"] == "1"
  puts "DRY: not submitting"; exit 0
end
call("PATCH", "/v1/reviewSubmissions/#{sub["id"]}", { data: { type: "reviewSubmissions", id: sub["id"], attributes: { submitted: true } } })
puts "SUBMITTED #{VERSION} (#{BUILD}) for review, automatic release"
