# App Store Connect helper (rebuilt 2026-10-03 after the scratchpad was wiped).
# Same API key as apps/ios/ship.sh; the .p8 is read from disk and never printed.
#
#   ruby scripts/asc/asc.rb versions
#   ruby scripts/asc/asc.rb submit VER BUILD [whats-new.txt]   # attach build, What's New, submit, auto-release
#   ruby scripts/asc/asc.rb cancel                              # cancel the open review submission
#   DRY=1 ruby scripts/asc/asc.rb submit ...                    # print what would change
require_relative "asc_lib"

case ARGV[0]
when "versions"
  call("GET", "/v1/apps/#{APP}/appStoreVersions?filter[platform]=IOS&limit=5" \
              "&fields[appStoreVersions]=versionString,appStoreState,releaseType,createdDate")["data"].each do |v|
    a = v["attributes"]
    puts "#{a["versionString"]}  #{a["appStoreState"]}  #{a["releaseType"]}  #{a["createdDate"]}"
  end
  open_submissions.each { |s| puts "open submission #{s["id"]} #{s["attributes"]["state"]}" }

when "cancel"
  subs = open_submissions
  puts "no open submission" if subs.empty?
  subs.each do |s|
    call("PATCH", "/v1/reviewSubmissions/#{s["id"]}",
         { data: { type: "reviewSubmissions", id: s["id"], attributes: { canceled: true } } })
    puts "cancel requested #{s["id"]} (#{s["attributes"]["state"]})"
  end

when "submit"
  ver, build_no, notes_file = ARGV[1], ARGV[2], ARGV[3]
  abort("usage: submit VER BUILD [whats-new.txt]") unless ver && build_no
  v = version(ver) or abort("version #{ver} not found")
  vid = v["id"]
  puts "version #{ver}: #{v["attributes"]["appStoreState"]} release=#{v["attributes"]["releaseType"]}"
  if v["attributes"]["releaseType"] != "AFTER_APPROVAL"
    call("PATCH", "/v1/appStoreVersions/#{vid}",
         { data: { type: "appStoreVersions", id: vid, attributes: { releaseType: "AFTER_APPROVAL" } } })
    puts "  releaseType -> AFTER_APPROVAL (auto-release)"
  end

  b = call("GET", "/v1/builds?filter[app]=#{APP}&filter[version]=#{build_no}" \
                  "&filter[preReleaseVersion.version]=#{ver}&fields[builds]=version,processingState")["data"]
         .find { |x| x["attributes"]["processingState"] == "VALID" } or abort("build #{build_no} not VALID")
  call("PATCH", "/v1/appStoreVersions/#{vid}/relationships/build", { data: { type: "builds", id: b["id"] } })
  puts "attached build #{build_no}"

  if notes_file
    notes = File.read(notes_file, encoding: "UTF-8").strip
    loc = call("GET", "/v1/appStoreVersions/#{vid}/appStoreVersionLocalizations")["data"]
            .find { |l| l["attributes"]["locale"] == "en-US" } or abort("no en-US localization")
    call("PATCH", "/v1/appStoreVersionLocalizations/#{loc["id"]}",
         { data: { type: "appStoreVersionLocalizations", id: loc["id"], attributes: { whatsNew: notes } } })
    puts "What's New set (#{notes.length} chars)"
  end

  sub = open_submissions.find { |s| s["attributes"]["state"] == "READY_FOR_REVIEW" }
  sub ||= call("POST", "/v1/reviewSubmissions",
               { data: { type: "reviewSubmissions", attributes: { platform: "IOS" },
                         relationships: { app: { data: { type: "apps", id: APP } } } } })["data"]
  call("POST", "/v1/reviewSubmissionItems",
       { data: { type: "reviewSubmissionItems",
                 relationships: { reviewSubmission: { data: { type: "reviewSubmissions", id: sub["id"] } },
                                  appStoreVersion: { data: { type: "appStoreVersions", id: vid } } } } })
  call("PATCH", "/v1/reviewSubmissions/#{sub["id"]}",
       { data: { type: "reviewSubmissions", id: sub["id"], attributes: { submitted: true } } })
  puts "SUBMITTED #{ver} (#{build_no}) for review, automatic release"

else
  abort("usage: ruby scripts/asc/asc.rb versions|cancel|submit VER BUILD [whats-new.txt]")
end
