/**
 * Câu thiền / cổ ngữ Hán-Việt hiển thị random ở tab Đăng Nhập
 * (file 02 §1.3, mở rộng L3 — session 9d).
 *
 * Mở rộng từ 7 câu lên 64 câu chia 4 chủ đề (tu tâm / hành đạo /
 * bản tính tự nhiên / khí phách quân tử) để loading screen ít lặp.
 * Khi tích hợp Auth Phase 1, dùng helper `randomProverb()`.
 *
 * Tiêu chí thêm câu mới:
 * - Phong cách Hán-Việt cổ phong, hợp game tu tiên MUD.
 * - Không gây hiểu nhầm tôn giáo cụ thể (Phật/Đạo/Nho hoà trộn).
 * - Không trích dẫn nguyên văn kinh điển có bản quyền.
 * - Câu ngắn (<= 80 ký tự khi có thể) để vừa loading splash.
 */
export const PROVERBS: readonly string[] = [
  // === Tu tâm — định ý — vô niệm (16 câu) ===
  'Tâm tịnh như nước, đạo tự nhiên thành.',
  'Một niệm khởi, vạn pháp sinh.',
  'Tâm động không bằng tâm tịnh.',
  'Tịnh tâm bất khởi, tà niệm vô sinh.',
  'Phiền não tức bồ đề.',
  'Vạn pháp do tâm sinh, vạn pháp do tâm diệt.',
  'Tâm như minh kính đài, thời thời cần phất thức.',
  'Buông được mới có thể đắc.',
  'Nhân tâm bất túc xà thôn tượng.',
  'Khí hoà tắc tâm bình.',
  'Tĩnh dạ tư đạo, tịch nhiên quan tâm.',
  'Vạn duyên buông xuống, một niệm bất sinh.',
  'Định lực chưa đủ, đừng nói thần thông.',
  'Nội quan tự tỉnh, ngoại quan tự minh.',
  'Tâm vô quái ngại, đạo tại nhãn tiền.',
  'Niệm khởi tức giác, giác chi tức vô.',

  // === Hành đạo — tu luyện — đột phá (16 câu) ===
  'Vô vi nhi vô bất vi.',
  'Đạo khả đạo, phi thường đạo.',
  'Phù tiên giả, thần dữ đạo hợp.',
  'Tiên đạo vô đường, duy hữu chân tâm.',
  'Trúc cơ vạn nhật, đắc đạo nhất triêu.',
  'Đại đạo chí giản, chân lý chí thuần.',
  'Cảnh giới nhất bậc, thiên địa khác biệt.',
  'Tu chân giả tu tâm, tu tâm giả tu hành.',
  'Đạo cao một thước, ma cao một trượng.',
  'Tu đạo như nghịch thuỷ hành châu, bất tiến tắc thoái.',
  'Linh khí ngũ phương quy tụ, cốt cách tự nhiên đăng tiên.',
  'Bế quan ba ngày, không bằng minh sư một lời.',
  'Hữu duyên thiên lý lai tương ngộ.',
  'Mỗi niệm thanh tịnh, mỗi bước đăng cao.',
  'Đả toạ tham thiền, tâm khô như tỉnh.',
  'Đạo bất nguyện thành, vạn vật tự thành.',

  // === Bản tính tự nhiên — vô thường — nhân quả (16 câu) ===
  'Hoa rơi tự có ý, nước chảy tự vô tình.',
  'Vạn vật giai không, nhân quả bất không.',
  'Thiên đạo vô thân, thường dữ thiện nhân.',
  'Có nhân tất có quả, có quả tất có nhân.',
  'Mây trắng tự bay, nước xanh tự chảy.',
  'Sinh tử hữu mệnh, phú quý tại thiên.',
  'Thiên võng khôi khôi, sơ nhi bất lậu.',
  'Phong vũ vô thường, đạo tâm bất biến.',
  'Hoa khai hoa tạ, nhật xuất nhật lạc.',
  'Đại tượng vô hình, đại âm hi thanh.',
  'Đại trí nhược ngu, đại xảo nhược chuyết.',
  'Sương sớm bất kiên, mộng huyễn bất trường.',
  'Sông cạn núi mòn, đạo tâm vĩnh thường.',
  'Cây có cội, nước có nguồn, người có gốc tâm.',
  'Trồng dưa được dưa, trồng đậu được đậu.',
  'Một sa lạc địa, vạn cảnh sinh diệt.',

  // === Khí phách quân tử — chí khí — bằng hữu (16 câu) ===
  'Thiên hành kiện, quân tử dĩ tự cường bất tức.',
  'Tu thân, tề gia, trị quốc, bình thiên hạ.',
  'Phú quý bất năng dâm, bần tiện bất năng di, uy vũ bất năng khuất.',
  'Quân tử dĩ ôn hậu lập đức, dĩ tinh nghĩa hành sự.',
  'Quân tử cầu chư kỷ, tiểu nhân cầu chư nhân.',
  'Quân tử chi giao đạm như thuỷ.',
  'Tri kỷ tri bỉ, bách chiến bất đãi.',
  'Đường dài mới biết ngựa hay, ngày tận mới biết tâm thật.',
  'Núi cao còn có núi cao hơn.',
  'Học vô chỉ cảnh, đạo vô chung điểm.',
  'Một lời quân tử nặng tựa Thái Sơn.',
  'Lửa thử vàng, gian nan thử đạo tâm.',
  'Cần lao đắc thiên đạo, lười biếng tự huỷ thân.',
  'Hữu xạ tự nhiên hương, đạo cao tự hữu môn đồ.',
  'Trượng nghĩa khinh tài, thượng đức bất đức.',
  'Bằng hữu nhất ngôn, đạo lữ nhất đời.',
] as const;

export function randomProverb(rng: () => number = Math.random): string {
  return PROVERBS[Math.floor(rng() * PROVERBS.length)];
}
