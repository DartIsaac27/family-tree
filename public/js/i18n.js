// All on-screen wording in Bahasa Malaysia (default) and English.
// Use FTI18n.t('key', { name: 'Ali' }) in code, or data-i18n="key" in HTML.
(function () {
  'use strict';

  const STRINGS = {
    ms: {
      'app.name': 'Peta Pokok Fatimah',
      'app.tagline': 'Salasilah keluarga kita, di satu tempat',

      'tab.home': 'Utama',
      'tab.tree': 'Salasilah',
      'tab.map': 'Peta',
      'tab.memories': 'Kenangan',
      'tab.more': 'Lagi',

      'common.save': 'Simpan',
      'common.cancel': 'Batal',
      'common.close': 'Tutup',
      'common.delete': 'Padam',
      'common.edit': 'Sunting',
      'common.done': 'Selesai',
      'common.back': 'Kembali',
      'common.search': 'Cari',
      'common.yes': 'Ya',
      'common.no': 'Tidak',
      'common.none': 'Tiada',
      'common.unknown': 'Tidak diketahui',
      'common.loading': 'Memuatkan…',
      'common.saving': 'Menyimpan…',
      'common.saved': 'Disimpan',
      'common.deleted': 'Dipadam',
      'common.optional': 'pilihan',
      'common.people': '{n} orang',
      'common.photos': '{n} gambar',
      'common.seeAll': 'Lihat semua',
      'common.clear': 'Kosongkan',

      'error.generic': 'Maaf, ada masalah. Sila cuba lagi.',
      'error.network': 'Tiada sambungan internet. Sila cuba lagi.',

      'search.placeholder': 'Cari nama atau nama panggilan…',
      'search.short': 'Cari ahli keluarga…',
      'search.title': 'Cari ahli keluarga',
      'search.noResults': 'Tiada padanan untuk "{q}"',
      'search.hint': 'Taip sekurang-kurangnya satu huruf.',

      'home.hello': 'Selamat datang',
      'home.helloUser': 'Hai, {name}!',
      'home.statMembers': 'Ahli',
      'home.statGenerations': 'Generasi',
      'home.statStates': 'Negeri',
      'home.statAlbums': 'Album',
      'home.birthdays': 'Hari jadi bulan {month}',
      'home.noBirthdays': 'Tiada hari jadi yang direkodkan bulan ini.',
      'home.birthdayToday': 'Hari ini! 🎉',
      'home.turns': 'Genap {age} tahun',
      'home.wish': 'Ucap',
      'home.wishMessage': 'Selamat hari jadi, {name}! 🎂 Semoga dirahmati dan sihat selalu.',
      'home.quick': 'Pintasan',
      'home.quickTree': 'Lihat salasilah',
      'home.quickMap': 'Peta keluarga',
      'home.quickRelation': 'Cari hubungan',
      'home.quickAdd': 'Tambah ahli',
      'home.recentMemories': 'Kenangan terkini',
      'home.loginCardTitle': 'Log masuk untuk lebih lagi',
      'home.loginCardBody': 'Lihat nombor telefon & alamat, tambah ahli keluarga dan muat naik gambar kenangan.',
      'home.missingInfo': '{n} ahli belum ada negeri lahir',

      'tree.chart': 'Carta',
      'tree.list': 'Senarai',
      'tree.showingFamily': 'Keluarga {a} & {b}',
      'tree.showingBranch': 'Keturunan {name}',
      'tree.showAll': 'Tunjuk semua',
      'tree.empty': 'Salasilah masih kosong',
      'tree.emptyBody': 'Tambah orang pertama untuk bermula — biasanya datuk atau nenek yang paling tua.',
      'tree.addFirst': 'Tambah orang pertama',
      'tree.zoomIn': 'Zum masuk',
      'tree.zoomOut': 'Zum keluar',
      'tree.fit': 'Muat skrin',
      'tree.viewFamily': 'Lihat keluarga ini',
      'tree.marriages': '{n} perkahwinan',
      'tree.children': '{n} anak',
      'tree.hint': 'Tekan label "Suami/Isteri" untuk lihat keluarga itu sahaja.',

      'spouse.husbandN': 'Suami ke-{n}',
      'spouse.wifeN': 'Isteri ke-{n}',
      'spouse.spouseN': 'Pasangan ke-{n}',
      'spouse.husband': 'Suami',
      'spouse.wife': 'Isteri',
      'spouse.spouse': 'Pasangan',

      'person.deceased': 'Arwah',
      'person.born': 'Lahir',
      'person.age': '{n} tahun',
      'person.birthDate': 'Tarikh lahir',
      'person.deathDate': 'Tarikh meninggal',
      'person.birthState': 'Negeri lahir',
      'person.livesIn': 'Tinggal di',
      'person.address': 'Alamat',
      'person.phone': 'No. telefon',
      'person.notes': 'Catatan',
      'person.call': 'Telefon',
      'person.whatsapp': 'WhatsApp',
      'person.edit': 'Sunting',
      'person.inTree': 'Di salasilah',
      'person.openMaps': 'Buka di Google Maps',
      'person.privateHidden': 'Log masuk untuk lihat no. telefon & alamat.',
      'person.parents': 'Ibu bapa',
      'person.father': 'Bapa',
      'person.mother': 'Ibu',
      'person.spouses': 'Pasangan',
      'person.children': 'Anak-anak',
      'person.childrenWith': 'Bersama {name}',
      'person.childrenUnknownParent': 'Ibu/bapa lain tidak diketahui',
      'person.siblings': 'Adik-beradik',
      'person.halfMother': 'seibu',
      'person.halfFather': 'sebapa',
      'person.memories': 'Kenangan',
      'person.addFather': 'Tambah bapa',
      'person.addMother': 'Tambah ibu',
      'person.addSpouse': 'Tambah pasangan',
      'person.addChild': 'Tambah anak',
      'person.showDescendants': 'Lihat keturunan',
      'person.findRelation': 'Cari hubungan',
      'person.familyOf': 'Keluarga {a} & {b}',
      'person.deleteConfirm': 'Padam {name}? Ini tidak boleh dibuat asal.',
      'person.notFound': 'Orang ini tidak dijumpai.',

      'form.addTitle': 'Tambah ahli keluarga',
      'form.editTitle': 'Sunting maklumat',
      'form.photo': 'Gambar profil',
      'form.photoAdd': 'Tambah gambar',
      'form.photoChange': 'Tukar gambar',
      'form.photoRemove': 'Buang gambar',
      'form.fullName': 'Nama penuh',
      'form.fullNameHint': 'Contoh: Ahmad bin Ali, Siti Aminah binti Yusof',
      'form.nickname': 'Nama panggilan',
      'form.nicknameHint': 'Contoh: Along, Mak Teh, Pak Ngah',
      'form.gender': 'Jantina',
      'form.male': 'Lelaki',
      'form.female': 'Perempuan',
      'form.birthDate': 'Tarikh lahir',
      'form.birthDateHint': 'Tahun sahaja pun boleh.',
      'form.day': 'Hari',
      'form.month': 'Bulan',
      'form.year': 'Tahun',
      'form.birthState': 'Negeri lahir',
      'form.chooseState': '— Pilih negeri —',
      'form.outsideMalaysia': 'Luar Malaysia',
      'form.deceased': 'Sudah meninggal dunia',
      'form.deathDate': 'Tarikh meninggal (jika tahu)',
      'form.sectionFamily': 'Keluarga',
      'form.father': 'Bapa',
      'form.mother': 'Ibu',
      'form.chooseFather': 'Pilih bapa',
      'form.chooseMother': 'Pilih ibu',
      'form.fatherSuggest': 'Adakah bapanya {name}?',
      'form.useThis': 'Ya, guna',
      'form.sectionContact': 'Hubungi',
      'form.privateNote': 'Hanya ahli yang log masuk boleh lihat.',
      'form.phone': 'No. telefon',
      'form.phoneHint': 'Contoh: 012-345 6789',
      'form.livesState': 'Negeri tinggal sekarang',
      'form.address': 'Alamat',
      'form.addressHint': 'Contoh: No 5, Jalan Mawar, 81800 Ulu Tiram, Johor',
      'form.sectionOther': 'Lain-lain',
      'form.notes': 'Catatan',
      'form.notesHint': 'Kisah, pekerjaan, kenangan…',
      'form.sectionSpouses': 'Pasangan',
      'form.spouseOrderHint': 'Susun ikut urutan perkahwinan (pertama di atas).',
      'form.moveUp': 'Naik',
      'form.moveDown': 'Turun',
      'form.remove': 'Buang',
      'form.removeSpouseConfirm': 'Buang {name} sebagai pasangan?',
      'form.deletePerson': 'Padam orang ini',
      'form.nameRequired': 'Sila isi nama penuh.',
      'form.yearInvalid': 'Tahun tidak sah.',

      'dup.title': 'Orang ini mungkin sudah ada',
      'dup.body': 'Kami jumpa nama yang sama atau hampir sama dalam salasilah:',
      'dup.inline': 'Nama ini sudah wujud dalam salasilah.',
      'dup.blocked': 'Nama ini sudah wujud. Hanya admin boleh simpan nama yang sama — pilih orang itu, atau hubungi admin jika ini memang orang lain.',
      'dup.inlineSimilar': 'Ada nama yang hampir sama.',
      'dup.view': 'Lihat',
      'dup.same': 'Nama sama',
      'dup.similar': 'Ejaan hampir sama',
      'dup.sibling': 'Nama & ibu bapa sama',
      'dup.useExisting': 'Ya, ini orangnya',
      'dup.createAnyway': 'Bukan, ini orang lain — simpan',
      'dup.childOf': 'anak {name}',

      'pick.title': 'Pilih orang',
      'pick.search': 'Cari nama…',
      'pick.addNew': 'Tambah orang baru',
      'pick.none': 'Tiada padanan.',
      'pick.selected': '{n} dipilih',
      'pick.moreResults': 'Taip untuk cari lagi…',
      'pick.childWithTitle': 'Anak bersama siapa?',
      'pick.childWithBody': '{name} ada lebih daripada seorang pasangan. Anak ini dengan siapa?',
      'pick.childWithUnknown': 'Tidak diketahui',
      'pick.addChildTitle': 'Tambah anak untuk {name}',
      'pick.addSpouseTitle': 'Tambah pasangan untuk {name}',
      'pick.existingHint': 'Pilih jika orang itu sudah ada, atau tambah baru.',

      'crop.title': 'Laraskan gambar',
      'crop.hint': 'Seret untuk gerak, cubit untuk zum.',
      'crop.use': 'Guna gambar ini',

      'map.born': 'Tempat lahir',
      'map.lives': 'Tempat tinggal',
      'map.bornTitle': 'Di mana ahli keluarga dilahirkan',
      'map.livesTitle': 'Di mana ahli keluarga tinggal',
      'map.byState': 'Ikut negeri',
      'map.stateCount': '{state} · {n} orang',
      'map.noneYet': 'Belum ada maklumat negeri. Sunting profil ahli untuk isi negeri.',
      'map.missing': '{n} ahli belum isi maklumat ini',
      'map.allStates': 'Semua negeri',
      'map.nobodyHere': 'Tiada ahli keluarga di negeri ini lagi.',
      'map.loginForPins': 'Log masuk untuk lihat lokasi rumah setiap ahli.',

      'mem.title': 'Kenangan keluarga',
      'mem.newAlbum': 'Album baru',
      'mem.empty': 'Belum ada kenangan',
      'mem.emptyBody': 'Cipta album untuk majlis keluarga — Hari Raya, perkahwinan, kenduri — dan semua boleh muat naik gambar.',
      'mem.allAlbums': 'Semua album',
      'mem.addPhotos': 'Tambah gambar',
      'mem.noPhotos': 'Belum ada gambar dalam album ini.',
      'mem.albumTitle': 'Nama majlis / album',
      'mem.albumTitleHint': 'Contoh: Hari Raya 2025, Kahwin Along',
      'mem.eventDate': 'Tarikh majlis',
      'mem.description': 'Cerita ringkas',
      'mem.people': 'Siapa yang ada',
      'mem.tagPeople': 'Tag ahli keluarga',
      'mem.editAlbum': 'Sunting album',
      'mem.deleteAlbum': 'Padam album',
      'mem.deleteAlbumConfirm': 'Padam album "{title}" dan semua gambarnya?',
      'mem.deletePhotoConfirm': 'Padam gambar ini?',
      'mem.uploading': 'Memuat naik {i} / {n}…',
      'mem.uploaded': '{n} gambar dimuat naik',
      'mem.uploadFailed': '{n} gambar gagal dimuat naik',
      'mem.caption': 'Kapsyen',
      'mem.captionPrompt': 'Tulis kapsyen untuk gambar ini:',
      'mem.download': 'Muat turun',
      'mem.by': 'oleh',
      'mem.albumNotFound': 'Album tidak dijumpai.',

      'rel.title': 'Cari hubungan',
      'rel.intro': 'Pilih dua orang untuk tahu bagaimana mereka bersaudara.',
      'rel.first': 'Orang pertama',
      'rel.second': 'Orang kedua',
      'rel.choose': 'Tekan untuk pilih',
      'rel.swap': 'Tukar',
      'rel.commonAncestor': 'Nenek moyang yang sama',
      'rel.path': 'Jalan hubungan',
      'rel.sentence': '{a} ialah {label} kepada {b}.',
      'rel.sentenceOfSpouse': '{a} ialah {label} kepada pasangan {b} ({s}).',
      'rel.sentenceSpouseOf': '{a} ialah pasangan kepada {label} {b} ({s}).',
      'rel.none': 'Tiada hubungan darah atau perkahwinan langsung dijumpai dalam salasilah.',
      'rel.self': 'Itu orang yang sama!',

      'more.title': 'Lagi',
      'more.account': 'Akaun',
      'more.login': 'Log masuk dengan Google',
      'more.logout': 'Log keluar',
      'more.loginNotReady': 'Log masuk belum disediakan oleh admin.',
      'more.language': 'Bahasa',
      'more.theme': 'Tema',
      'more.light': 'Cerah',
      'more.dark': 'Gelap',
      'more.tour': 'Panduan penggunaan',
      'more.manageUsers': 'Urus pengguna',
      'more.privacy': 'No. telefon, alamat dan lokasi rumah hanya boleh dilihat oleh ahli keluarga yang log masuk.',

      'login.title': 'Log masuk',
      'login.body': 'Log masuk dengan akaun Google anda untuk menambah ahli keluarga, menyunting maklumat, melihat no. telefon & alamat, dan memuat naik gambar.',
      'login.failed': 'Log masuk gagal. Sila cuba lagi.',
      'login.welcome': 'Selamat datang, {name}!',
      'login.required': 'Sila log masuk dahulu.',

      'admin.title': 'Urus pengguna',
      'admin.body': 'Akaun yang disekat tidak boleh menambah, menyunting atau memadam apa-apa.',
      'admin.block': 'Sekat',
      'admin.unblock': 'Nyahsekat',
      'admin.blocked': 'Disekat',
      'admin.none': 'Belum ada pengguna.',

      'tour.next': 'Seterusnya',
      'tour.skip': 'Langkau',
      'tour.step': 'Langkah {i} / {n}',
      'tour.1.title': 'Selamat datang! 👋',
      'tour.1.body': 'Ini salasilah keluarga kita. Gunakan menu di bawah skrin untuk bergerak antara Utama, Salasilah, Peta, Kenangan dan Lagi.',
      'tour.2.title': 'Salasilah 🌳',
      'tour.2.body': 'Seret dan cubit untuk zum. Tekan mana-mana orang untuk lihat maklumatnya. Nenek yang berkahwin lebih sekali berada di atas, dan setiap suami di bawahnya bersama anak-anak mereka.',
      'tour.3.title': 'Tambah & sunting ✏️',
      'tour.3.body': 'Tekan butang + untuk tambah ahli. Jika nama sudah wujud, kami akan beri amaran supaya tiada rekod berganda.',
      'tour.4.title': 'Peta & Kenangan 📷',
      'tour.4.body': 'Lihat negeri kelahiran setiap ahli di Peta, dan simpan gambar majlis keluarga di Kenangan.',

      'months': ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'],
    },

    en: {
      'app.name': "Fatimah's Family Tree",
      'app.tagline': 'Our family history, all in one place',

      'tab.home': 'Home',
      'tab.tree': 'Tree',
      'tab.map': 'Map',
      'tab.memories': 'Memories',
      'tab.more': 'More',

      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.close': 'Close',
      'common.delete': 'Delete',
      'common.edit': 'Edit',
      'common.done': 'Done',
      'common.back': 'Back',
      'common.search': 'Search',
      'common.yes': 'Yes',
      'common.no': 'No',
      'common.none': 'None',
      'common.unknown': 'Unknown',
      'common.loading': 'Loading…',
      'common.saving': 'Saving…',
      'common.saved': 'Saved',
      'common.deleted': 'Deleted',
      'common.optional': 'optional',
      'common.people': '{n} people',
      'common.photos': '{n} photos',
      'common.seeAll': 'See all',
      'common.clear': 'Clear',

      'error.generic': 'Sorry, something went wrong. Please try again.',
      'error.network': 'No internet connection. Please try again.',

      'search.placeholder': 'Search name or nickname…',
      'search.short': 'Find a family member…',
      'search.title': 'Find a family member',
      'search.noResults': 'No matches for "{q}"',
      'search.hint': 'Type at least one letter.',

      'home.hello': 'Welcome',
      'home.helloUser': 'Hi, {name}!',
      'home.statMembers': 'Members',
      'home.statGenerations': 'Generations',
      'home.statStates': 'States',
      'home.statAlbums': 'Albums',
      'home.birthdays': 'Birthdays in {month}',
      'home.noBirthdays': 'No birthdays recorded this month.',
      'home.birthdayToday': 'Today! 🎉',
      'home.turns': 'Turns {age}',
      'home.wish': 'Wish',
      'home.wishMessage': 'Happy birthday, {name}! 🎂 Wishing you good health and happiness.',
      'home.quick': 'Shortcuts',
      'home.quickTree': 'View family tree',
      'home.quickMap': 'Family map',
      'home.quickRelation': 'Find relationship',
      'home.quickAdd': 'Add member',
      'home.recentMemories': 'Recent memories',
      'home.loginCardTitle': 'Sign in for more',
      'home.loginCardBody': 'See phone numbers & addresses, add family members and upload memory photos.',
      'home.missingInfo': '{n} members have no birth state yet',

      'tree.chart': 'Chart',
      'tree.list': 'List',
      'tree.showingFamily': 'Family of {a} & {b}',
      'tree.showingBranch': 'Descendants of {name}',
      'tree.showAll': 'Show all',
      'tree.empty': 'The family tree is empty',
      'tree.emptyBody': 'Add the first person to start — usually the oldest grandparent.',
      'tree.addFirst': 'Add first person',
      'tree.zoomIn': 'Zoom in',
      'tree.zoomOut': 'Zoom out',
      'tree.fit': 'Fit to screen',
      'tree.viewFamily': 'View this family',
      'tree.marriages': '{n} marriages',
      'tree.children': '{n} children',
      'tree.hint': 'Tap a "Husband/Wife" label to see only that family.',

      'spouse.husbandN': 'Husband #{n}',
      'spouse.wifeN': 'Wife #{n}',
      'spouse.spouseN': 'Spouse #{n}',
      'spouse.husband': 'Husband',
      'spouse.wife': 'Wife',
      'spouse.spouse': 'Spouse',

      'person.deceased': 'Late',
      'person.born': 'Born',
      'person.age': '{n} years old',
      'person.birthDate': 'Date of birth',
      'person.deathDate': 'Date of death',
      'person.birthState': 'Birth state',
      'person.livesIn': 'Lives in',
      'person.address': 'Address',
      'person.phone': 'Phone',
      'person.notes': 'Notes',
      'person.call': 'Call',
      'person.whatsapp': 'WhatsApp',
      'person.edit': 'Edit',
      'person.inTree': 'In tree',
      'person.openMaps': 'Open in Google Maps',
      'person.privateHidden': 'Sign in to see phone number & address.',
      'person.parents': 'Parents',
      'person.father': 'Father',
      'person.mother': 'Mother',
      'person.spouses': 'Spouses',
      'person.children': 'Children',
      'person.childrenWith': 'With {name}',
      'person.childrenUnknownParent': 'Other parent unknown',
      'person.siblings': 'Siblings',
      'person.halfMother': 'same mother',
      'person.halfFather': 'same father',
      'person.memories': 'Memories',
      'person.addFather': 'Add father',
      'person.addMother': 'Add mother',
      'person.addSpouse': 'Add spouse',
      'person.addChild': 'Add child',
      'person.showDescendants': 'View descendants',
      'person.findRelation': 'Find relationship',
      'person.familyOf': 'Family of {a} & {b}',
      'person.deleteConfirm': 'Delete {name}? This cannot be undone.',
      'person.notFound': 'This person was not found.',

      'form.addTitle': 'Add family member',
      'form.editTitle': 'Edit details',
      'form.photo': 'Profile photo',
      'form.photoAdd': 'Add photo',
      'form.photoChange': 'Change photo',
      'form.photoRemove': 'Remove photo',
      'form.fullName': 'Full name',
      'form.fullNameHint': 'e.g. Ahmad bin Ali, Siti Aminah binti Yusof',
      'form.nickname': 'Nickname',
      'form.nicknameHint': 'e.g. Along, Mak Teh, Pak Ngah',
      'form.gender': 'Gender',
      'form.male': 'Male',
      'form.female': 'Female',
      'form.birthDate': 'Date of birth',
      'form.birthDateHint': 'Just the year is fine too.',
      'form.day': 'Day',
      'form.month': 'Month',
      'form.year': 'Year',
      'form.birthState': 'Birth state',
      'form.chooseState': '— Choose state —',
      'form.outsideMalaysia': 'Outside Malaysia',
      'form.deceased': 'Has passed away',
      'form.deathDate': 'Date of death (if known)',
      'form.sectionFamily': 'Family',
      'form.father': 'Father',
      'form.mother': 'Mother',
      'form.chooseFather': 'Choose father',
      'form.chooseMother': 'Choose mother',
      'form.fatherSuggest': 'Is the father {name}?',
      'form.useThis': 'Yes, use',
      'form.sectionContact': 'Contact',
      'form.privateNote': 'Only signed-in family members can see this.',
      'form.phone': 'Phone number',
      'form.phoneHint': 'e.g. 012-345 6789',
      'form.livesState': 'Current state',
      'form.address': 'Address',
      'form.addressHint': 'e.g. No 5, Jalan Mawar, 81800 Ulu Tiram, Johor',
      'form.sectionOther': 'Other',
      'form.notes': 'Notes',
      'form.notesHint': 'Stories, job, memories…',
      'form.sectionSpouses': 'Spouses',
      'form.spouseOrderHint': 'Order by marriage (first at the top).',
      'form.moveUp': 'Up',
      'form.moveDown': 'Down',
      'form.remove': 'Remove',
      'form.removeSpouseConfirm': 'Remove {name} as spouse?',
      'form.deletePerson': 'Delete this person',
      'form.nameRequired': 'Please fill in the full name.',
      'form.yearInvalid': 'Invalid year.',

      'dup.title': 'This person may already exist',
      'dup.body': 'We found the same or a very similar name in the tree:',
      'dup.inline': 'This name already exists in the tree.',
      'dup.blocked': 'This name already exists. Only an admin can save the same name — pick that person, or ask the admin if this really is someone else.',
      'dup.inlineSimilar': 'There is a very similar name.',
      'dup.view': 'View',
      'dup.same': 'Same name',
      'dup.similar': 'Similar spelling',
      'dup.sibling': 'Same name & parents',
      'dup.useExisting': "Yes, that's them",
      'dup.createAnyway': "No, it's someone else — save",
      'dup.childOf': 'child of {name}',

      'pick.title': 'Choose a person',
      'pick.search': 'Search name…',
      'pick.addNew': 'Add a new person',
      'pick.none': 'No matches.',
      'pick.selected': '{n} selected',
      'pick.moreResults': 'Type to search more…',
      'pick.childWithTitle': 'Child with whom?',
      'pick.childWithBody': '{name} has more than one spouse. Who is the other parent of this child?',
      'pick.childWithUnknown': 'Unknown',
      'pick.addChildTitle': 'Add a child for {name}',
      'pick.addSpouseTitle': 'Add a spouse for {name}',
      'pick.existingHint': 'Pick them if they are already in the tree, or add a new person.',

      'crop.title': 'Adjust photo',
      'crop.hint': 'Drag to move, pinch to zoom.',
      'crop.use': 'Use this photo',

      'map.born': 'Birthplace',
      'map.lives': 'Lives in',
      'map.bornTitle': 'Where family members were born',
      'map.livesTitle': 'Where family members live',
      'map.byState': 'By state',
      'map.stateCount': '{state} · {n} people',
      'map.noneYet': 'No state info yet. Edit members’ profiles to fill it in.',
      'map.missing': '{n} members have not filled this in',
      'map.allStates': 'All states',
      'map.nobodyHere': 'No family members in this state yet.',
      'map.loginForPins': 'Sign in to see each member’s home location.',

      'mem.title': 'Family memories',
      'mem.newAlbum': 'New album',
      'mem.empty': 'No memories yet',
      'mem.emptyBody': 'Create an album for a family event — Hari Raya, weddings, kenduri — and everyone can upload photos.',
      'mem.allAlbums': 'All albums',
      'mem.addPhotos': 'Add photos',
      'mem.noPhotos': 'No photos in this album yet.',
      'mem.albumTitle': 'Event / album name',
      'mem.albumTitleHint': "e.g. Hari Raya 2025, Along's wedding",
      'mem.eventDate': 'Event date',
      'mem.description': 'Short story',
      'mem.people': 'Who was there',
      'mem.tagPeople': 'Tag family members',
      'mem.editAlbum': 'Edit album',
      'mem.deleteAlbum': 'Delete album',
      'mem.deleteAlbumConfirm': 'Delete album "{title}" and all its photos?',
      'mem.deletePhotoConfirm': 'Delete this photo?',
      'mem.uploading': 'Uploading {i} / {n}…',
      'mem.uploaded': '{n} photos uploaded',
      'mem.uploadFailed': '{n} photos failed to upload',
      'mem.caption': 'Caption',
      'mem.captionPrompt': 'Write a caption for this photo:',
      'mem.download': 'Download',
      'mem.by': 'by',
      'mem.albumNotFound': 'Album not found.',

      'rel.title': 'Find relationship',
      'rel.intro': 'Pick two people to see how they are related.',
      'rel.first': 'First person',
      'rel.second': 'Second person',
      'rel.choose': 'Tap to choose',
      'rel.swap': 'Swap',
      'rel.commonAncestor': 'Common ancestor',
      'rel.path': 'How they connect',
      'rel.sentence': "{a} is {b}'s {label}.",
      'rel.sentenceOfSpouse': "{a} is the {label} of {b}'s spouse ({s}).",
      'rel.sentenceSpouseOf': "{a} is married to {b}'s {label} ({s}).",
      'rel.none': 'No direct blood or marriage link was found in the tree.',
      'rel.self': "That's the same person!",

      'more.title': 'More',
      'more.account': 'Account',
      'more.login': 'Sign in with Google',
      'more.logout': 'Sign out',
      'more.loginNotReady': 'Sign-in has not been set up by the admin yet.',
      'more.language': 'Language',
      'more.theme': 'Theme',
      'more.light': 'Light',
      'more.dark': 'Dark',
      'more.tour': 'How to use',
      'more.manageUsers': 'Manage users',
      'more.privacy': 'Phone numbers, addresses and home locations are only visible to signed-in family members.',

      'login.title': 'Sign in',
      'login.body': 'Sign in with your Google account to add family members, edit details, see phone numbers & addresses, and upload photos.',
      'login.failed': 'Sign-in failed. Please try again.',
      'login.welcome': 'Welcome, {name}!',
      'login.required': 'Please sign in first.',

      'admin.title': 'Manage users',
      'admin.body': 'Blocked accounts cannot add, edit or delete anything.',
      'admin.block': 'Block',
      'admin.unblock': 'Unblock',
      'admin.blocked': 'Blocked',
      'admin.none': 'No users yet.',

      'tour.next': 'Next',
      'tour.skip': 'Skip',
      'tour.step': 'Step {i} / {n}',
      'tour.1.title': 'Welcome! 👋',
      'tour.1.body': 'This is our family tree. Use the menu at the bottom of the screen to move between Home, Tree, Map, Memories and More.',
      'tour.2.title': 'The tree 🌳',
      'tour.2.body': 'Drag and pinch to zoom. Tap anyone to see their details. A grandmother who married more than once sits on top, with each husband below her together with their children.',
      'tour.3.title': 'Add & edit ✏️',
      'tour.3.body': 'Tap the + button to add a member. If the name already exists, we will warn you so there are no double records.',
      'tour.4.title': 'Map & Memories 📷',
      'tour.4.body': "See every member's birth state on the Map, and keep family event photos in Memories.",

      'months': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    },
  };

  let lang = 'ms';
  try {
    const saved = localStorage.getItem('familyTreeLang');
    if (saved === 'en' || saved === 'ms') lang = saved;
  } catch { /* storage unavailable */ }

  function t(key, vars) {
    const table = STRINGS[lang] || STRINGS.ms;
    let s = key in table ? table[key] : (key in STRINGS.ms ? STRINGS.ms[key] : key);
    if (typeof s === 'string' && vars) {
      s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    }
    return s;
  }

  function applyStatic(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
    (root || document).querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-label'))); });
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'ms');
  }

  function setLang(next) {
    lang = next === 'en' ? 'en' : 'ms';
    try { localStorage.setItem('familyTreeLang', lang); } catch { /* ignore */ }
    applyStatic();
  }

  // ---- relationship wording ----

  const G = (gender, male, female, other) => (gender === 'male' ? male : gender === 'female' ? female : other);

  function ordinalEn(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // What `rel` (a blood relation from FTFamily.bloodRelation) is called,
  // for someone of the given gender.
  function bloodLabel(rel, gender) {
    const n = rel.n || 0;
    if (lang === 'en') {
      const great = (k) => 'great-'.repeat(Math.max(0, k));
      switch (rel.kind) {
        case 'self': return 'self';
        case 'parent': return G(gender, 'father', 'mother', 'parent');
        case 'grandparent': return great(n - 1) + G(gender, 'grandfather', 'grandmother', 'grandparent');
        case 'child': return G(gender, 'son', 'daughter', 'child');
        case 'grandchild': return great(n - 1) + G(gender, 'grandson', 'granddaughter', 'grandchild');
        case 'sibling': {
          const base = G(gender, 'brother', 'sister', 'sibling');
          if (rel.half) return `half-${base} (${rel.half === 'mother' ? 'same mother' : 'same father'})`;
          if (rel.older === true) return `older ${base}`;
          if (rel.older === false) return `younger ${base}`;
          return base;
        }
        case 'uncle': return (n > 1 ? great(n - 2) + 'grand-' : '') + G(gender, 'uncle', 'aunt', 'uncle/aunt');
        case 'nephew': return (n > 1 ? great(n - 2) + 'grand-' : '') + G(gender, 'nephew', 'niece', 'nephew/niece');
        case 'cousin': {
          const r = rel.removed;
          const rem = r === 0 ? '' : r === 1 ? ' once removed' : r === 2 ? ' twice removed' : ` ${r} times removed`;
          return `${n === 1 ? 'first' : ordinalEn(n)} cousin${rem}`;
        }
        default: return 'relative';
      }
    }
    switch (rel.kind) {
      case 'self': return 'diri sendiri';
      case 'parent': return G(gender, 'bapa', 'ibu', 'ibu/bapa');
      case 'grandparent':
        if (n === 1) return G(gender, 'datuk', 'nenek', 'datuk/nenek');
        return n === 2 ? 'moyang' : `moyang (${n + 1} generasi ke atas)`;
      case 'child': return G(gender, 'anak lelaki', 'anak perempuan', 'anak');
      case 'grandchild': return ['cucu', 'cicit', 'piut', 'anggun'][n - 1] || `keturunan (${n + 1} generasi ke bawah)`;
      case 'sibling': {
        let base = rel.older === true ? G(gender, 'abang', 'kakak', 'adik-beradik') : rel.older === false ? 'adik' : 'adik-beradik';
        if (rel.half) base += rel.half === 'mother' ? ' seibu' : ' sebapa';
        return base;
      }
      case 'uncle':
        if (n === 1) return G(gender, 'bapa saudara', 'mak saudara', 'bapa/mak saudara');
        if (n === 2) return G(gender, 'datuk saudara', 'nenek saudara', 'datuk/nenek saudara');
        return 'moyang saudara';
      case 'nephew': return ['anak saudara', 'cucu saudara', 'cicit saudara'][n - 1] || 'cicit saudara';
      case 'cousin': {
        const base = n === 1 ? 'sepupu' : `${['', '', 'dua', 'tiga', 'empat', 'lima'][n] || n} pupu`;
        return rel.removed ? `${base} (beza ${rel.removed} generasi)` : base;
      }
      default: return 'saudara';
    }
  }

  function spouseLabel(gender) {
    return lang === 'en' ? G(gender, 'husband', 'wife', 'spouse') : G(gender, 'suami', 'isteri', 'pasangan');
  }

  function siblingInLaw(gender, older) {
    if (lang === 'en') return G(gender, 'brother-in-law', 'sister-in-law', 'sibling-in-law');
    if (older === true) return G(gender, 'abang ipar', 'kakak ipar', 'ipar');
    if (older === false) return 'adik ipar';
    return 'ipar';
  }

  // Returns { label, sentence } for the result of FTFamily.relationship.
  // a/b/s are person objects (s = the spouse involved, for in-laws).
  function describeRelation(rel, a, b, s, nameOf) {
    const A = nameOf(a), B = nameOf(b), S = s ? nameOf(s) : '';
    if (rel.type === 'none') return { label: null, sentence: t('rel.none') };
    if (rel.type === 'blood' && rel.kind === 'self') return { label: null, sentence: t('rel.self') };
    let label;
    if (rel.type === 'blood') label = bloodLabel(rel, a.gender);
    else if (rel.type === 'spouse') label = spouseLabel(a.gender);
    else if (rel.type === 'relOfSpouse') {
      const k = rel.rel.kind;
      if (k === 'parent') label = lang === 'en' ? G(a.gender, 'father-in-law', 'mother-in-law', 'parent-in-law') : G(a.gender, 'bapa mertua', 'ibu mertua', 'mertua');
      else if (k === 'child') label = lang === 'en' ? G(a.gender, 'stepson', 'stepdaughter', 'stepchild') : 'anak tiri';
      else if (k === 'sibling' && !rel.rel.half) label = siblingInLaw(a.gender, rel.rel.older);
      else {
        return { label: bloodLabel(rel.rel, a.gender), sentence: t('rel.sentenceOfSpouse', { a: A, b: B, s: S, label: bloodLabel(rel.rel, a.gender) }) };
      }
    } else if (rel.type === 'spouseOfRel') {
      const k = rel.rel.kind;
      if (k === 'parent') label = lang === 'en' ? G(a.gender, 'stepfather', 'stepmother', 'step-parent') : G(a.gender, 'bapa tiri', 'ibu tiri', 'ibu/bapa tiri');
      else if (k === 'child') label = lang === 'en' ? G(a.gender, 'son-in-law', 'daughter-in-law', 'child-in-law') : 'menantu';
      else if (k === 'grandchild' && rel.rel.n === 1) label = lang === 'en' ? G(a.gender, 'grandson-in-law', 'granddaughter-in-law', 'grandchild-in-law') : 'cucu menantu';
      else if (k === 'sibling' && !rel.rel.half) label = siblingInLaw(a.gender, rel.rel.older);
      else {
        const sl = bloodLabel(rel.rel, s && s.gender);
        return { label: sl, sentence: t('rel.sentenceSpouseOf', { a: A, b: B, s: S, label: sl }) };
      }
    }
    return { label, sentence: t('rel.sentence', { a: A, b: B, label }) };
  }

  window.FTI18n = {
    t,
    applyStatic,
    setLang,
    getLang: () => lang,
    months: () => t('months'),
    describeRelation,
  };
})();
