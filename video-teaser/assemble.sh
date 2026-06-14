#!/bin/zsh
# xyndrome teaser assembly — concat frame-chained clips, overlay logo + tagline, mix VO over native clip audio
set -e
FF=$(python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")
DIR=/Applications/XAMPP/xamppfiles/htdocs/lms/video-teaser
LOGO=$DIR/logo-full.png
FONT=$DIR/PlusJakartaSans-Bold.ttf
cd "$DIR"

# 1. Normalize all clips to 1080x1920 30fps, uniform codecs (required for concat)
for i in 1 2 3 4 5 6; do
  [ -f clips/N$i.mp4 ] || $FF -y -i clips/C$i.mp4 \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" \
    -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p \
    -c:a aac -b:a 192k -ar 48000 -ac 2 \
    clips/N$i.mp4 2>/dev/null
done

# 2. Measure actual clip durations and compute beat boundaries
durs=()
for i in 1 2 3 4 5 6; do
  d=$($FF -i clips/N$i.mp4 -f null - 2>&1 | grep -o 'time=[0-9:.]*' | tail -1 | sed 's/time=//' | awk -F: '{print $1*3600+$2*60+$3}')
  durs+=($d)
done
b1=0
b2=$(echo "$b1 + ${durs[1]}" | bc)
b3=$(echo "$b2 + ${durs[2]}" | bc)
b4=$(echo "$b3 + ${durs[3]}" | bc)
b5=$(echo "$b4 + ${durs[4]}" | bc)
b6=$(echo "$b5 + ${durs[5]}" | bc)
total=$(echo "$b6 + ${durs[6]}" | bc)
echo "boundaries: $b1 $b2 $b3 $b4 $b5 $b6 total=$total"

# VO placement: synced to scene boundaries
vo1=0.3
vo2=$(echo "$b2 + 0.6" | bc)
vo3=$(echo "$b3 + 0.4" | bc)
vo4=$(echo "$b4 + 0.3" | bc)
vo5=$(echo "$b5 + 0.4" | bc)
vo6=$(echo "$b6 + 1.2" | bc)
LOGO_T=$(echo "$b6 + 1.5" | bc)
TAG_T=$(echo "$LOGO_T + 1.2" | bc)
FADE_T=$(echo "$total - 0.8" | bc)
ms() { echo "($1 * 1000)/1" | bc; }
echo "vo offsets: $vo1 $vo2 $vo3 $vo4 $vo5 $vo6 | logo $LOGO_T tag $TAG_T"

# 3. Hard concat (clips are frame-chained, so no transition needed)
printf "file 'N1.mp4'\nfile 'N2.mp4'\nfile 'N3.mp4'\nfile 'N4.mp4'\nfile 'N5.mp4'\nfile 'N6.mp4'\n" > clips/list.txt
$FF -y -f concat -safe 0 -i clips/list.txt -c copy clips/master-video.mp4 2>/dev/null

# 4. Overlay logo + tagline, mix VO lines at beat offsets over ducked native audio
$FF -y -i clips/master-video.mp4 -loop 1 -i "$LOGO" \
  -i audio/vo1.mp3 -i audio/vo2.mp3 -i audio/vo3.mp3 \
  -i audio/vo4.mp3 -i audio/vo5.mp3 -i audio/vo6.mp3 \
  -filter_complex "\
[1:v]scale=740:-1,format=rgba,fade=t=in:st=${LOGO_T}:d=1.0:alpha=1[logo]; \
[0:v][logo]overlay=(W-w)/2:(H-h)/2-150:enable='gte(t,${LOGO_T})'[vl]; \
[vl]drawtext=fontfile=${FONT}:text='Your exam prep starts now.':fontsize=52:fontcolor=0x0F172A:x=(w-text_w)/2:y=(h)/2+330:alpha='if(lt(t,${TAG_T}),0,min(1,(t-${TAG_T})/0.8))'[v]; \
[0:a]volume=0.5[bed]; \
[2:a]adelay=$(ms $vo1)|$(ms $vo1)[a1]; [3:a]adelay=$(ms $vo2)|$(ms $vo2)[a2]; [4:a]adelay=$(ms $vo3)|$(ms $vo3)[a3]; \
[5:a]adelay=$(ms $vo4)|$(ms $vo4)[a4]; [6:a]adelay=$(ms $vo5)|$(ms $vo5)[a5]; [7:a]adelay=$(ms $vo6)|$(ms $vo6)[a6]; \
[a1][a2][a3][a4][a5][a6]amix=inputs=6:normalize=0,volume=1.5[vo]; \
[bed][vo]amix=inputs=2:normalize=0,alimiter=limit=0.95,afade=t=out:st=${FADE_T}:d=0.8[a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 \
  -t $total \
  xyndrome-teaser-9x16.mp4
echo "DONE: $DIR/xyndrome-teaser-9x16.mp4"
