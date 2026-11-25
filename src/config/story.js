import firstRoomPhoto from "../../images/im1.jpeg";
import secondRoomPhoto from "../../images/im2.jpeg";
import promiseRoomPhoto from "../../images/image.png";

// Personalize the experience here. Add a local audio file under public/ and
// point backgroundMusic at it (for example: "/music/our-song.mp3").
export const STORY = {
  princessName: "Princess",
  yourName: "Your love",
  welcomeTitle: "Welcome to my little world, {name} ❤️",
  welcomeSubtitle: "I made something special for you...",
  roomOneTitle: "بداية حكايتنا",
  roomOneMessage: "ليوم اول مرة نسمع صوتك\nاول مرة نسمع ضحكاتك الزوين\nليوم اول نهار ليا فالحياة\nنت عطيتيني الروح نت حياتي من اول شوفة\nفعويناتك الكبار الزوينين قلبي عرف معنى الوطن\nفشخص من اول مرة شفت جمال خلاب كمال وحيد\nو مع الوقت كتاشفت بلي مور الجمال الخارجي كان\nجمال داخلي كمال فالعقل و الشخصية\nكنبغيييييييييييييييييييييييييييييييييييك\nكنحممممممممممممممممممممممممماق عليك",
  roomTwoTitle: "",
  roomTwoMessage: "روحي معاك الى اخر نفس فالحياة\nقلبي و روحي فداك نعطيك عمري\nباش نشوفك بيخير فرحانة الى الابد\nنت روووووحي وحيااااتي غتغادر\nالاجساد ديالنا الارض و غتبقى روحي معاك\nكنبغيييييييييييييييييييييييييييييييييييك\nفوق حد الهواس نعطيك عمري\nباش نشوفك عايشة حياة الاميرات",
  proposalMessage: "لا حياة بلا روح و نت هي\nالروووووووووح ديالي نت النور\nد حياتي مصدر سعادتي نت حياتي\nوكل ما عندي تقبلي تكوني\nشريكة حياتي الى الابد حطي يدك\nفيدي الى اخر العمر نت وطني\nاهلي و كل ناسي",
  question: "WILL YOU MARRY ME? 💍",
  finalMessage: "انا اسعد رجل فالدنيا كلها بسباب\nوجود اميرة الكماااااااااااااال فحياتي\nمرتي الجوهرة النادرة ديالي كنطير بالفرحة\nمن اول يمات لينا و انا فقمة السعادة\nكملات السعادة ديالي بالتعرف على عائلتك\nعاءلتنا بجوج كنمووووووووووووووووووووووووت عليك\nكنبغيييييييييييييييييييييييييييييييييييك\nكنبغيييييييييييييييييييييييييييييييييييك",
  foreverLine: "Forever starts with us.",
  // Local wall photos, in order: two frames in Room One, one frame in Room Two.
  photos: [firstRoomPhoto, secondRoomPhoto, promiseRoomPhoto],
  // Optional local track. If empty, a quiet synthesized ambient chord is used.
  backgroundMusic: "",
  theme: {
    blush: "#d99ba4",
    ivory: "#fff5e9",
    champagne: "#e8c891",
    rose: "#9f3d50",
    ink: "#1b1116",
  },
};

export const stages = ["welcome", "room1", "hall1", "room2", "hall2", "room3", "ending"];

export const stageRoomNumber = {
  room1: 1,
  hall1: 1,
  room2: 2,
  hall2: 2,
  room3: 3,
  ending: 3,
};
