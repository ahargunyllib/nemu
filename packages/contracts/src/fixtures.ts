import type { NemuRequest, NemuResponse } from "./index.js";

export const momentOneRequest = {
  session_id: "s-001",
  user_id: "rina",
  url: "https://app.demo/",
  prompt: "Saya dapat tugas rapat ke Makassar 3 hari, mulai dari mana?",
  elements: [
    {
      nemu_id: "menu-ajukan-perjalanan-dinas",
      label: "Ajukan Perjalanan Dinas",
      role: "link",
      visible: true,
    },
  ],
} satisfies NemuRequest;

export const momentOneResponse = {
  status: "answer",
  answer: {
    ringkas:
      "Ini perjalanan dinas luar kota. Saya bukakan formulir Ajukan Perjalanan Dinas; siapkan empat dokumen sebelum mengirim.",
    detail: [
      "Dokumen yang disiapkan:",
      "1. Nomor surat tugas dari Kepala Balai",
      "2. Undangan atau kerangka acuan rapat",
      "3. Jadwal berangkat dan kembali",
      "4. Rincian perkiraan biaya (dibuat otomatis dari isian form)",
    ].join("\n"),
  },
  citations: [
    { doc_id: "sop-pd-01", judul: "SOP-PD-01 Perjalanan Dinas", pasal: "Butir 4.1, 4.2, 4.4" },
  ],
  calc: [],
  actions: [
    {
      type: "click",
      target: "menu-ajukan-perjalanan-dinas",
      level: "jalan_sendiri",
      label: "Buka formulir",
    },
  ],
  guide: {
    id: "travel-request:create",
    steps: [
      { id: "travel-type", target: "select-jenis-perjalanan", label: "Pilih jenis perjalanan" },
      { id: "destination-city", target: "select-kota-tujuan", label: "Pilih kota tujuan" },
      {
        id: "assignment-letter",
        target: "select-dasar-penugasan",
        label: "Pilih dasar penugasan",
      },
      {
        id: "travel-purpose",
        target: "input-maksud-perjalanan",
        label: "Isi maksud perjalanan",
      },
      {
        id: "departure-date",
        target: "input-tanggal-berangkat",
        label: "Isi tanggal berangkat",
      },
      { id: "return-date", target: "input-tanggal-kembali", label: "Isi tanggal kembali" },
    ],
    current_step: 1,
  },
  warnings: [],
} satisfies NemuResponse;

export const momentOneFollowUpRequest = {
  session_id: "s-001",
  user_id: "rina",
  url: "https://app.demo/perdin/baru",
  prompt: "Saya dapat tugas rapat ke Makassar 3 hari, mulai dari mana?",
  elements: [
    {
      nemu_id: "select-jenis-perjalanan",
      label: "Jenis perjalanan",
      role: "combobox",
      visible: true,
    },
    {
      nemu_id: "select-kota-tujuan",
      label: "Kota tujuan",
      role: "combobox",
      visible: true,
    },
    {
      nemu_id: "select-dasar-penugasan",
      label: "Dasar penugasan",
      role: "combobox",
      visible: true,
    },
    {
      nemu_id: "input-maksud-perjalanan",
      label: "Maksud perjalanan",
      role: "textbox",
      visible: true,
    },
    {
      nemu_id: "tab-jadwal",
      label: "2 Jadwal",
      role: "tab",
      visible: true,
    },
  ],
} satisfies NemuRequest;

export const momentOneFollowUpResponse = {
  status: "answer",
  answer: {
    ringkas: "Formulir sudah terbuka. Ikuti enam langkah yang disorot sebelum mengirim pengajuan.",
    detail:
      "Isi jenis perjalanan, kota tujuan, dasar penugasan, dan maksud perjalanan, lalu buka tab Jadwal untuk tanggal berangkat dan kembali.",
  },
  citations: [
    { doc_id: "sop-pd-01", judul: "SOP-PD-01 Perjalanan Dinas", pasal: "Butir 4.1, 4.2" },
  ],
  calc: [],
  actions: [
    {
      type: "highlight",
      target: "select-jenis-perjalanan",
      level: "arahkan",
      label: "Pilih jenis perjalanan",
    },
    {
      type: "highlight",
      target: "select-kota-tujuan",
      level: "arahkan",
      label: "Pilih kota tujuan",
    },
    {
      type: "highlight",
      target: "select-dasar-penugasan",
      level: "arahkan",
      label: "Pilih dasar penugasan",
    },
    {
      type: "highlight",
      target: "input-maksud-perjalanan",
      level: "arahkan",
      label: "Isi maksud perjalanan",
    },
    {
      type: "highlight",
      target: "tab-jadwal",
      level: "arahkan",
      label: "Buka tab Jadwal",
    },
  ],
  guide: {
    id: "travel-request:create",
    steps: [
      { id: "travel-type", target: "select-jenis-perjalanan", label: "Pilih jenis perjalanan" },
      { id: "destination-city", target: "select-kota-tujuan", label: "Pilih kota tujuan" },
      {
        id: "assignment-letter",
        target: "select-dasar-penugasan",
        label: "Pilih dasar penugasan",
      },
      {
        id: "travel-purpose",
        target: "input-maksud-perjalanan",
        label: "Isi maksud perjalanan",
      },
      {
        id: "departure-date",
        target: "input-tanggal-berangkat",
        label: "Isi tanggal berangkat",
      },
      { id: "return-date", target: "input-tanggal-kembali", label: "Isi tanggal kembali" },
    ],
    current_step: 1,
  },
  warnings: ["Kamu yang menekan Kirim setelah seluruh isian dan dokumen lengkap"],
} satisfies NemuResponse;

export const momentTwoRequest = {
  session_id: "s-001",
  user_id: "rina",
  url: "https://app.demo/perdin/baru",
  prompt: "Saya menginap di rumah saudara, ini diisi apa?",
  screenshot_crop:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAAAXNSR0IArs4c6QAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAABLKADAAQAAAABAAABLAAAAAD7qKDdAAAqMElEQVR4Ae2dB5gVRdb+D5JBsoAkSQoioiJiWEUUxfRfs39FYWUXBb/vQ1BXjKAiLiYUWEXMgosB1ryfYEAwIpjJEkSykvMAQ+rvvGeoS8+dO8PAHWDKeut5hnu7u7q66nduv33O6aarSKRFWEiABEjAAwIHedBHdpEESIAEjAAFiz8EEiABbwhQsLwxFTtKAiRAweJvgARIwBsCFCxvTMWOkgAJULD4GyABEvCGAAXLG1OxoyRAAhQs/gZIgAS8IUDB8sZU7CgJkAAFi78BEiABbwhQsLwxFTtKAiRAweJvgARIwBsCFCxvTMWOkgAJULD4GyABEvCGAAXLG1OxoyRAAhQs/gZIgAS8IUDB8sZU7CgJkAAFi78BEiABbwgUS7enX3/9tWzfvj3RTKlSpaR58+ZSrFjaTSfazM+X0aNHS2Zmppx22mlSsWLF/OzCOiRAAp4RKJLuO91Lly4tmzdvzjbsypUry0UXXST9+vWTQw45JNu2fbVQtWpVWbFihYwfP15OPvnkfXUYtksCJHAACRSYG3TBBRdI3bp1ZfHixQJvZ+jQoTasIUOG7Jfhde7cWdavXy81atTYL8fjQUiABPY/gQLLYd14440yePBgee+996R79+42EoSLKPDAbr/9djnyyCOlVq1acvHFF8v06dNt29atW6VNmzZy1llnyYgRI+T000+XJk2ayF133WUek1XSf958803znLB/t27d5L777pPWrVvLyJEjrcq0adNk8uTJsnHjRgsN4222atXK2rz77rsTbWKyoP79+8uJJ55oInfOOedI3759Bf1B6dq1q7X/8ssvS7t27UyML730Uvn1119tO/6BN9e2bVupU6eOHH/88QIGs2fPtu0QbfShV69eNvbGjRvb8vPPP5/Yf82aNeaFwhNN9lITlfiFBEhgFwGEhOkUzVlhmrBo1KhRiWZUUGzdEUccYeuuuOIKW0a9kiVL2ncNG6Nffvkl2rRpU2LbQQcdFBUtWjSx/Le//c32HzNmTFSkSJHEerTj/p577jmro6GnrVMRiTIyMhLb0V68zeuuu87qqxAl6mg4mWi/T58+tv2UU05JbHfHwmft2rUjFcVo7dq1ibGUL18+0tDY6h911FE52sd+GJtr54MPPrA6M2fOTKxbtmyZreM/JEACuRMoMA8L3kqnTp3kjDPOME9LT07p2LGjeVLwjlRw5JtvvjEPBzmmVatWyYsvvohqidK7d29RsZEuXbrYum+//dY+0bYOwTyepUuXyp6Emffff79s2LBBrr/++mxtTpgwQerVqyeDBg0SFYvEMb///vtEf/ClRYsWsmDBAnnppZekePHismjRIvMEx40bZ57ZhRdeKMuXLxcVbNsPnqOKcKINFWiZOHGizJs3Txo1amTr3biQ/2vZsqX9lShRIrEPv5AACeRCIHcty98W52Fp8wlvAevOP//8aOXKlZGGebZeT0hbh/X169e3dRr+ZfOw4HGh/Oc//7HtqIeiIZctoy1XDj/8cFu3Ow9LQzjb5d1337X6DRs2tGW9sxm98sor0TXXXBNpOJfwwtA/FOdhqVDZMv7RO5DWhoartu67776LNPyNzjzzzKhChQq2DRzgfTkPDm270qFDB6tzxx13uFX8JAES2AMCBZZ079mzp3kj5cqVk1NPPVXgPaDAu0GBh7Vu3Tr7XrNmTcEfclrxUqlSJVvUEC6+OuGx4JEJV8qWLeu+5vmZW5s9evSQAQMGCDwg5M3gGWromaMtDeUS6zA2FDzG8eWXX8rZZ58tW7ZskWbNmomGvTk8RtR1x8f35HFhHQsJkED+Cew6G/O/T8qaECkkpXESO7FCRfWErD5O8uHDh8tXX30ljz32mGguSdS7SdlW8krXBpLyKJMmTbIEe3K9PVl2yW/06eOPP5ZDDz005e6vv/66rVevyZLsWEAo+a9//cvE6qqrrrK+XHLJJSn3z2slEu24MYG/bdu25VWV20iABJRAgXlYudHEXThNvtvdsz//+c/mjbz99tt2N8+JQW77uvXIaSHn9Nprr8nYsWMFeSz1It3mvfrU0NCEDyIIbwl5NpT4Q7BYhphpyGeihLt6ZcqUkcsuu0wgYCgQT9xdxN1EV5LbcOuTP5Ebg9CjII+GZ8lYSIAEcieQtoeFUA/FfSYfCmEcxOC4446zk1vzRnYLH48tXHnlldmquzaSP//617/Kgw8+aEluhJV4KBVhGIp7oj55H9dw8nq3jEcc8IArPCzNgwk8JRQk3Z0YYRmhouaq7CaB3g2UYcOGSfXq1UXvYErTpk1lxowZcu+998oJJ5wgmsfCLhZauuO4T6x3390n1rmSap3bxk8SIIEsAmk/6Z5fkPCIcKdME/H2TFR+c1Bo33lVCA0hDPB08KwWPK0ffvjBnoHKbz/i9fDMlT5aYLk0J3xu+5/+9CcLAeEN4qFYPH+F4+NOYbzguSs8zR/PVcW38zsJkEDBEdjnIaHrKjwIvetnf25dfj/ff/99S5BD5JAgR84HXhD+z+AxxxyT32Zy1IP4HH300TnWJ69AYh4Cmaog3GUhARLYPwT2m2ClMxzkiCAu8LSQU4JQ4cl4PEOV7Bmlc5z4vgjv4DVBrFhIgAQKB4H9FhIW1HARxiWHZQXVNtshARIo3AS8E6zCjZO9IwES2JcE0r5LuC87x7ZJgARIIE6AghWnwe8kQAKFmgAFq1Cbh50jARKIE6BgxWnwOwmQQKEmQMEq1OZh50iABOIEKFhxGvxOAiRQqAlQsAq1edg5EiCBOAEKVpwGv5MACRRqAhSsQm0edo4ESCBOgIIVp8HvJEAChZoABatQm4edIwESiBOgYMVp8DsJkEChJkDBKtTmYedIgATiBChYcRr8TgIkUKgJULAKtXnYORIggTiBAnnjKN7Vjmmz8GbQ5IK3gmLmHPwlF7yMD1N+5VYwbyHepa6Tm4pOAZ+jmk6Oaut2N8UWXrGM+QXxbvbCXvr16yeYTTp5zsb91e9p06bZLNa33XabTaaxZMkSad++fbbDYy5G2Bqzaeskt9m2FeQCZjTCRCFt27YtyGbZls8E9mDS1Vyr6rRX0cMPP5xyO2Zx1veuRzrvXo7tGzdujHTmmcSfTjQaValSJbF8yy23RPoe9+jVV1/NsS9W6Gw6UceOHVNui6+89tprI53lJr6q0H7XVzLbbNkHqoM6i1CkswLZ4cG/devWObqi79O3Gax1erQc23a3AjNwt2zZcnfVbPu5554bdevWLV91WSkMAml7WJgC68MPPxSd0j2lbmMuwltvvVUwvZeKS7Y6mHB16tSpiXU1atQQTOn10EMPJdbhe0ivRMbkGoVlvPD2duzYkbBFQXzB+GbNmlUQTbGNAAmkncPCnH4QJTcnHxhmZmYmUGK2HMz59/TTTyfW7ckXhHGffPKJ7YJwBeFBPZ15GVPDL168ONHU8uXLpVOnTlK3bl1p3LixzSytHlxiu/uCqcHOOecc6dq1q1uV+ERYe/XVV8tNN91koQ4mUMWxMaN1tWrVbNLTOXPmJOr/85//tFl3ateubbNYo20UzHXYrl07wdyH6CumB3vyyScT+33++efWFmbcQT9uuOEGeeONN2y7ehXy2WefyerVq236smeffVZatGhhcyGiTTcmHAtzIx522GE2XoRnmEkaBReIO++80/qNKchOOeUUmw7NNib9s379euPWoEEDUW8qwRrVnnrqKbn55puT9ti1iJAcoT6OgTkmMzIybCP6/pe//MXWq8dsFypM74bZju655x7BMY8//nib7RoChlnAYTeE/X369ClwkdzVY37znkC6jqSeTNEDDzyQaGbw4MERwhqdsj6xDmGGClekJ1liXaovOl18pCdatk0ICdU7i/RKH2m+JNJ5CSOdJj5CmKfwEyFhhw4dIp2yK9J8VfTRRx9ZWOPCVBcSLlq0KFIxi3Ry1EhPmmzHwcL9999vbapARTrLdKSCYst68kVvvfVWpCeVHRd1VYAi9RAjzeVEo0ePjnQeQwtlsU2FzPY777zzrC868astr1q1Kpo7d67xQZ9UpIwTxqHeDHa1beAFVliP8AzLOE6JEiUiFX6rp+IVHXvssdHIkSMj9XAjFY1I84G2DcfFvjrBa6SCG+kMQ9aOTkJr2+P/qNBF4N6/f3+zI8YUDwl1WrV4dfvuQkLUe+aZZ6IBAwZEOiO2jRsV9AIW1apVK1KxNTYqhrZORSu64447LMz/9NNPzaboG2yCsB/MdaaiSIXejsOQ0DDwnxgBTPm+1wV5KZ3Z2U4o1wh+ZDhZIFArVqyw1RMnTrR1OHnyKnkJls7IbG38/PPP1gQEDPVdDgsn7uTJk6NNmzZFqANhUy/M6kIcIFI6L2KkU8NHyJ2lKhAs9FsTzba5R48eJkobNmywZfU2IvUo7DtOQuTQwAB/Ghpb/3766Sc7cXECu/0WLlxo28aNGxf17t3bTmaX01PPMNIbArkKFk5iV9B3l9OBMGs4beOdPn161Lx58wgihgLBQl1X3PGxT7xs3749Us/RBMetB8/8CtYLL7zgdjO+nTt3jhYsWGBjxUXFFVxw8JtQzyt6+eWXI/XGbRPshfXvvPNOgmOvXr3swoAKFCxHkJ+OQFo5LPUWLAyJ3ynSH5y59OphCcIBFEygigL3f28L8mQIy9zdM4SaelImmtOTz8ISzORctWpV6wPCMVcQZiFsxZ1J3OVC/ixVQViiJ6xtQh0cz81SjTkKVWisDdwZxR3MoUOHZmvGhYXoq9vPhcsI2cAMbeoNBtsP4RRC2NwKQjVX0I4L+zCOyy+/3PJBOBbGH29Hb2a43QQhq15YRD3MxDp8UXGVZcuW2eS0bsNpp51mOUm3nNcnQl1XXN9cyBy3javn2Lh9XC4LIXe8oK8sJJCKQFo5LDfJaDyXhB88Jju9/fbbE8dzP9R0ZklWj8WmudewJtEuclooyOsgn4NcD46Fv1atWiXq4UubNm0E9dXrEfWcsm2LLySfLBBGV1Tl7SuS4uXKlRMNb0z8IIDol4aGginuUZwg2ULsH9ymdycqVqPNOL9YVfuaqh2MAfm6k046yQQHjx4gTxUvyCO5MmXKFBM69UjdKvsEUxSIqCuOqVvO6zNV3zD5LArE3BUcHzdUGjVq5FbZp7ugIbcFhvhDX1zOMltlLpCAEkhLsOBZ4eoOryav8ssvv4jmXxLeUV51c9vmnsXp2bOnIMGuIYfMmDHDqiPJj4QvErk4CTSHZeIBr8MVJHU1ryKPPPKIaChj2922vfnEs2FIlGu4awlyiCBuBOB5r7wKhFNDNEHC/rfffjPxjItwXvu6bW68EGgI4AcffGCzYsfHi3XffPONsdJcnkCckFSPF1xAGjZsKAMHDhQNK+Xbb7+Vt99+O15lj783adLEbgTg+Tp4WxDXIUOG2I0ZiD9m6oaXCBui//j9aA7MLkYQS3hb6A8LCaQikPfZlWqPpHW4k4Yfe15Fc0qCH/LubtfjBx33aFybWKcJddHEsN1tRMimzwjZCYhtuKpDMO666y47MXHnDXee9Bkwe6A13q7mWQReID413+UOkfiMHz++HyrEl3GSoR+4SwbvASe6Jo4TYWByO25/3FHF3Tfc/YPga25OatasKc5bdfXwiZLcDpYhyrgTiIc7IUS4q4nxog8QBxSEgbANBEGflzKBr1ixom1z/0A8hg0bZh4fQkh4aRD95GO6+smf8XrYhmVcmNAmwk0IImyzZs0a80ZRBx4o+ox+wZvVHJ18puE6LiaahzPBf+KJJ1DVSvIx3Hp+BkrAJbP29nPMmDGWRFUPJ9cmcCcRd5IKoiCRj8S2ehk5msNdqNmzZyfWI3mOJPy+Kkj8a3gX/fjjj/k+joY80ahRo6xLSP4j+Y47Y+C4pwUs1HtN7Pb7779bP5B0v/HGGyP1ZCwxj37mVcAIY0BSvKAKjo02YY/k42Pc7oYMjoe6sKm7oVJQfWA7fzwCBTJVPbwGJNlTPbMzduxY6dKliz0gmpwfCvEaMX/+fEuOd+/e3Tw952EgrHbJ+XS5IFxNfvYr3Ta5PwkUBgJph4QYBEKc3BLHCBfxQCbFKsvcyKVBpJDfwYOlCMv0maQCEyscBWFq/C5h1pH5Lwn4T6BAPCz/MXAEJEACPhAoEA/Lh4GyjyRAAv4ToGD5b0OOgASCIUDBCsbUHCgJ+E+AguW/DTkCEgiGAAUrGFNzoCTgPwEKlv825AhIIBgCFKxgTM2BkoD/BChY/tuQIyCBYAhQsIIxNQdKAv4ToGD5b0OOgASCIUDBCsbUHCgJ+E+gQAQL//EZ03glF7yBEy+4y63gPUk6uYO9ITReB2+exHq8fbIgi77WRfR1JwXZJNsiARLYjwQKRLD+/e9/S/ny5XN0Gy+2w0vt8IbJVAWChdcp4+2T8QLBwnq8imV3RSefyHP26Pj+eCtCQYtgvH1+JwES2LcE0hYsvMcJXovOSpOjp3hLKN4uiXdi7asCMcRreFlIgAT++ATSmjUHeHTqKnv9cSoPC9t1ui17RS8mRN3bAg8MnhomNsBrlnWqc3v3N17DiwkM8KpjvLIYr01G3REjRghmtcEL8TB7C96jzkICJOA/gbQFS+ehE53QM1cSeLe4TiBqU0zhe6oC0cFEFa7EZ47GtFqYsAETLLhJHiBIWI9ZkvFmTYgTviOUfPzxx82r08lL7V3zqIvZXZInYHDH4icJkIA/BNISLMyNhymm3Iw2qYbtppbCnHi5CRZmj4nPWRif/QVvLIXXBO/JzUmIY37xxReisz3bZAaY1gvzCU6YMMFmsHFT1mMaLIgfZoOhYKWyDteRgF8E0hIsTMKpr7m3qaZyGzYmCkVJNUON2weeE/JdriAnhVlhUFxCHtNRuYIZVyBEycl89AcFXla8oD4LCZCA/wTSEiy8jxwFd/tyK27Ovb0VDSTtUSBcmA4LBd4a3o2e/J54N9Nynz59xE1phboIH1lIgAT8J5DWXUJMCY/p3BGi5Vac15NbOJjbfm49ZguGML733ns2yzHCRyTbXd4ME5fCI0NIibkPsYxJRLEO4eSgQYNk0qRJrjl+kgAJeEwgLQ8L4gBBgYjkVnSuPJvWPdUUVrnNkuwmz8QnJg1Frgp3Cd1DqA0aNEhMRY+8FqY2h1eFUPCaa66R4cOHy/jx461L2I4EPArac23bCv5DAiTgFYG0Z82ZMmWKPPPMM/Loo48mZj2OE+jbt695Ppdddll89R5/R74K4gfhw/Ts8YL8GHJpLnxEXSTisQwvkIUESOCPQSCtkBAImjVrZo8W6MzFOYhgino80oBHDtItyFfVr18/h1ihXYSlTqywjLrIcVGsQIOFBP44BNIWLKBo37696FT1Oaggf4VwziXDc1TgChIgARLYAwJph4R7cCxWJQESIIG0CBSIh5VWD7gzCZAACeSTAAUrn6BYjQRI4MAToGAdeBuwByRAAvkkQMHKJyhWIwESOPAEKFgH3gbsAQmQQD4JULDyCYrVSIAEDjwBCtaBtwF7QAIkkE8CFKx8gmI1EiCBA0+AgnXgbcAekAAJ5JMABSufoFiNBEjgwBOgYB14G7AHJEAC+SRAwconKFYTWbBqi7cYMrfukGXrtnrbf3Y8i0BaL/CbvGijHPvAzzLl3qPk6Fql//BML316jrw7cdfroEsULSKNDy0l3dtUk+tPy3p3fX4gDPxkqYybs0HeuGHXe+qx37btkfz/536V85qWlxtOryrPf7lcPp+Vc87FTqdWkTZHZp+4dvpvm+Tpz5fLrGWZclL9snL3+YdKqeJZ16O3f1wtI75fLdt2aPstKkm7llnvE9usJ/HAMcvks5nrpU7lEjaOZrnY8aNpa+X2txbLxHuayIbMHdL7f3+T7+ZtlKNqlJIOJ1eR0w4/OD9D36M6387NkJMfniEbBzVPjGWPGohVXr1xu5zw4M/yQ88mUr188dgWfvWJQFoelr4zz8oO98Wnke9FX3foCd+2STn5+f6m9jf+ziOlUbWS0nnYfJm9NPXs1smHwUl4yxuLZPrvOevfpyIAQfxtTZYnULlsMaldqXjib4sK2qvfrkpuUlZnbJPzn/xFxsxYLxccXV5GfLdK2r841+p9OHWtXPHsrwIbnVC3jFw7ZJ68trONm0cslH+M/F1a1isjGzZvlzMem6nHzulFbdm2Q/7ntQVy359r2Btbr3lhrgz9eqWc0bicFFPRbtVvpoz7Jaew5ujoHq5An/ETK4if16EViss1J1aWm3TMLP4SSMvDymvYt725SCqWKSo9L6hh1XrocvVyxeS2cw+VlnqlO+vIcvLB1HWyXUXgdl03Sk+ssXrCNa1ZSoZ3biAHlzxIzhowW87Uk+Kdn1bL5q2R3Nq2unRTbwZvF73nvd/Ma9ikXsJVJ1SSRy+vLZ+qp3D/+7/Ll7c1tmOOnr5OHv5wiYz5eyOtv1iWrtsmi1ZvkUmLNskV6mk0OKSEeRjwlPpdUVsuOrairNuk8x8+O0d6ab9Pb1QuxxDLlyoqR6pX5Qr69NZPa+TXFZkyY8lmeUlP5Mo67venrJXD1Gt5pv1h0qJuWasOUYCQtDisjKDf8fLFrPXy3JcrrE9u/eXHVxL8oYDT6SoMvS44NId3BZFbuWGbzOx/rHkiNSuWkKvUU/t97VZ58tNlcqXyAVOUiQuzPLFLj6toxxveub5ur2ztH9ztJ2N6y9nVra77571Ja2Xjlh1yie6zVUVzzIx11h54oXysnIdNWCmnJnlZbfrPMpGEkGLsPc6pLl/PyTBbH161pLx2fX2pW6WkzFRuPd9dLF/M3iANdT281euSPFaMH7+p/5281kQMv4unrznMBPPsAbOkeZ0yZv/1ehzY5Bu9MIxUGzTAca6rL/UO0QuLttn43mny0KWZUl+XWfwjkJaHlddwcQLHcx6/Ls+UhSoWKBMXbrTwpeMpVaSSehEdh86TZeu3Sd9LaiZOKJwY+NG9NG6FXtlrymXNK9rVER7A2yoQCGUgMrfpSYBQCOIEtx9hqiurN26TKYs32eK8lVvk+a9UEPQHjCvtE2OXyYMfLJG/68lZu1IJDXcWWT1c1Rerh5MsKK5NnLgQPfz9MD/D+lG6eBE5sV5ZWapjgHjgc7CeTCWLFZHuw3dd0bvpd4TOHU7K/opneEgdXporA6+sLTXUE0hVHv1oifF0F4B4ndkaBh6vIuhCQHh98EzmKHNs+1PDXeFao+olzRvENtRx24oeVMTYoH5ymaT2alqztE7wUcQuFhC/M3aK+RIVRdi5hXpvyQXsn1TO7VQwIRhdXllgov6Pi2vKXLXHgE+ypmXr+voCY/7CtXWldaODpbt6QcvXZ883vai2G6IXA4jeQ5fWkuHqRb7yzUo7pB1npzBDiG54dYFMUw/2AT3OfD1Ofw3BUSCGsMlH09bZMv/xj8A+87B2hwJX0b/rlbBWxeLylYYTT1xVx07m0T+vt5PM7Y8f59UqMPjDlfx9vcKiIDxCqNK5VVU7WSE638/fJVZu//gnjjXo6sPMmxg4ZqldceGxYf2V6pGgVCxTTKb1bhrfLdv3D/THXufOKdnW3XxWNRNerNRzWl7pVM/awUnetPc0O/ng/cHrmnrfUfJ6UliHE+wE9cLan1TFxDdb47oAr+GRj5bK4yrQTpTideatzDRv1q2rW6WEfYW3iBO2YumibpN5NOu0PeyDkm2beoTYJ7ng5G+w0yMpUewg80RR53P1ChFiIifk8mLJ++LiAK/6mNqlzX64yCDfhfzX7GVZYTEuXBD8quqBw5PCWH9R4dQ5QxIF+7+inhI8c2yDzeApu3K15uXgqcPT+kh/J49eVss85B/0N+FEGIKLC9b033ft5/bnpx8E9ptgQWDipfXOK3SZEgfZVc8l7UvpFTBeFye9K4er5wBxe7FjPXlTE8ntnp8rJbQ+ktQvXlvPVUt8btmW/ZinH5HlacCbwInnvAKIQFL3Em0kfzn3qPLytIZ5KGv15P675qMGf7ZcvcNatq6mekgQPRRc0ZF/Gati9V/qXVzQrIKGRBvsRMO+CHV3aGT4xg+rLbzB8goN7XBCISfkQix4F9pd+cvJ2T0zO4j+g9AT4ZQrmzR8RsHxkUxHm65sUg8R67EPCrYdrGEuCrxKbEsuszQ/d1ztrNDUbUN49vjopRaOg0e5nW247e4zbmesQziMUkq90u06dhTYqfVjM80zraailaocXLKoeasXDtpo+4JrvMAzQ8HvCSWbbVUEXamr4wZ7Fj8JpP51FNBYcNfLlXkaIiJn5ErpnXew3HL8M/5jjP+4kH+5WPMoOIEQcpXVH/Eo9VrufGexPPXZMmlSo7TeCdvVEsLAeEk+ZvKUX8iNJa+L74/vyK3F8x/3/L8aglzNXB0fCrwXVxBKgUAZHWvlskVlwq8b7G+Nhq6oh7zeHeoVgEu/j7PmdkQ4ukRzbRBRJ1gIZa/SPBNENlVBOIgkuCvIpSH0gcBjG8I/V7ANF4GjlBUuDtiGcA1jn7k0U/67dc5Zhoprjm9J7JEAiNWQr1fIyG6Hy/lHV3BNp/wsvVNA3Ma41wQ2yL11G75Arjv1EOmlLOGhVusx2VVPfMLGENQp6qE20RziWZq3ipe8bBv/PUGgT9S7qCx+Ekh9BuzhWCb8mqEJ83WJP+Sr6miI9rle9ZFTwl0phBV7U5BrgmjBy5ivuRIkW5HDukq9K9yWR8iBvE+G3mqvo3fUkGP61/iVJmrPfrF8jw8JD+RuPTmm7sx97a4BhCYoLpRat3mHelzLLAyEBwKBa6te2Zy+zRJ/fS6qKY2ql7LlLvr4QnzbKQ3Kyk0apg7rVN/aReIcdxQvOja7MEAM0U88X4RwEnmzf2qYO00fb8B6hFjwJHFnELkejOdN9eRgC+StcHfvWA2fcFNisebj8MgCTuaWul9yOUbzbi6sysjcrrmnpca9goaa8BjxFxfF5P3zWs5Q3rihgj6B1T9GZQk3HsGIFwhbY2UGbrhBM15/c/ELYrxuXt+RWz065rXnVZfbCh+BtDwsd7VEDiZe7ji3uoUvL6tw4Dmt+ppTQSLYeS/4dPviE1dVV5KXkVCtePNE8xi6tDrE7lQhrHhVT8KGPadaSAiP4cYzqwnCCeRHkMQvq1f24+rsOtFwCHdMHAvL7rhYn7W9iArednlIT2Ls68JU1EexvrmdslZJFb1pgIK7V8iPwGvBncqury+0u6IvaiI5Oe/kjreziWwfcTbYgBAYhzy5wa7EOdZPVWFCP+88Tz00PS5EEOEpznOI6Ge3NkI16XpGVetbsz7TbfnCYyrYOiw8dXUdaTtwttTWnBw8MiT9496j7aD/IKzDIxcoyAnBcX7y0+X2Zyv1H+Shhv61nlu0T2O6c03C9rFljAuhKfbFTQfUP0fFHc92Idx/578bZrWjG5DvvO7leVK66492gcIdy8F6swV3QO04+EeLs/HOxWw2g+itzNiew65Ze/JfLwhoKLDPyla9TM5dvnmv2l+doZfdLt9HPy3IsDawHC879KEovUsXzV+ZGV9t3xeuyow2Zm7PsX5fr9AHPaOGPadE2zRzPP23jfa5r48Zbx+Mpi7eGIFNcpmzbHO0SLkkF9ho0sKMSD2n5E2J5bUbt0UVbvop+mT62sS6gv6Cvi1du8WaRZ/0bnCOQ6CPM5dsSoxv8erMPWI88JMlUcu+03O0yxX+EEjLw9qdIiPsQH4k3ZKqDVyxkZ9JVXDH8EAWhGLIp+3vgmS/S/gnHxteWKoCGx1TOzVHV7+8hn7w4B7RRyvOapL9CXtXJ93PWjGboU+pHu9AQh0hoSt43iy/BY/J4DGKYXoHl8VfAvtUsNLBgiQqnqxO9cNNp919uS9CVeSf/ojlRg0tEcLhaX88HuBbQTiI5/xaHZHzYWDfxhJyfzmRasjW59hJwDMCBXKX0LMxs7skQAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiRAwQrR6hwzCXhKgILlqeHYbRIIkQAFK0Src8wk4CkBCpanhmO3SSBEAhSsEK3OMZOApwQoWJ4ajt0mgRAJULBCtDrHTAKeEqBgeWo4dpsEQiTwf4rN3IRuJzyRAAAAAElFTkSuQmCC",
  elements: [
    {
      nemu_id: "opt-penginapan-tidak-hotel",
      label: "Tidak menginap di hotel",
      role: "radio",
      visible: true,
    },
    {
      nemu_id: "input-nominal-penginapan",
      label: "Nominal penginapan",
      role: "textbox",
      visible: true,
    },
  ],
  process_context: {
    instance_id: "PD-2026-0042",
    active_task: "isi_rencana",
    destination_province: "Sulawesi Selatan",
    nights: 2,
    uploaded_documents: [],
  },
} satisfies NemuRequest;

export const momentTwoResponse = {
  status: "answer",
  answer: {
    ringkas:
      "Pilih Tidak menginap di hotel, lalu isi nominal penginapan Rp447.000 untuk dua malam.",
    detail:
      "Masukkan nominal secara manual. Perhitungannya 30% x Rp745.000 x 2 malam. Ubah pilihan jika nanti menginap di hotel.",
  },
  citations: [
    {
      doc_id: "pmk-119-2023",
      judul: "PMK 119/2023",
      pasal: "8 ayat (5)",
      halaman: 6,
    },
  ],
  calc: [
    {
      fungsi: "hitung_lumpsum_penginapan",
      input: { tarif: 745_000, malam: 2, persentase: 30 },
      hasil: 447_000,
      sumber: "SBM TA 2026 - Sulawesi Selatan - Hotel Golongan III",
    },
  ],
  actions: [
    {
      type: "highlight",
      target: "opt-penginapan-tidak-hotel",
      level: "arahkan",
      label: "Pilih: tidak menginap",
    },
    {
      type: "fill",
      target: "input-nominal-penginapan",
      level: "konfirmasi",
      label: "Isi Rp447.000",
      value: "447000",
    },
  ],
  guide: {
    id: "travel-request:accommodation",
    steps: [
      {
        id: "choose-non-hotel",
        target: "opt-penginapan-tidak-hotel",
        label: "Pilih: tidak menginap",
      },
      {
        id: "fill-accommodation-amount",
        target: "input-nominal-penginapan",
        label: "Isi Rp447.000",
      },
    ],
    current_step: 1,
  },
  warnings: ["Ubah isian bila nanti menginap di hotel"],
} satisfies NemuResponse;

export const momentThreeRequest = {
  session_id: "s-001",
  user_id: "rina",
  url: "https://app.demo/",
  prompt: "Saya sudah pulang kemarin, sekarang apa?",
  elements: [
    {
      nemu_id: "task-pertanggungjawaban",
      label: "Pertanggungjawaban",
      role: "link",
      visible: true,
    },
  ],
  process_context: {
    instance_id: "PD-2026-0042",
    active_task: "pertanggungjawaban",
    status: "Pertanggungjawaban",
    return_date: "2026-11-05",
    destination_province: "Sulawesi Selatan",
    nights: 2,
    uploaded_documents: ["surat_tugas", "boarding_pass_pergi"],
  },
} satisfies NemuRequest;

export const momentThreeResponse = {
  status: "answer",
  answer: {
    ringkas:
      "Saya bukakan task Pertanggungjawaban. Lengkapi laporan perjalanan dan boarding pass pulang sebelum 12 November 2026.",
    detail: "Batas pertanggungjawaban adalah lima hari kerja setelah tanggal kembali.",
  },
  citations: [{ doc_id: "pmk-113-2012", judul: "PMK 113/2012", pasal: "34" }],
  calc: [
    {
      fungsi: "batas_pertanggungjawaban",
      input: { tanggal_kembali: "2026-11-05", hari_kerja: 5 },
      hasil: "2026-11-12",
    },
  ],
  actions: [
    {
      type: "click",
      target: "task-pertanggungjawaban",
      level: "jalan_sendiri",
      label: "Buka Pertanggungjawaban",
    },
  ],
  guide: {
    id: "travel-request:accountability",
    steps: [
      {
        id: "upload-travel-report",
        target: "upload-laporan-perjalanan",
        label: "Unggah laporan perjalanan",
      },
      {
        id: "upload-return-boarding-pass",
        target: "upload-boarding-pass-pulang",
        label: "Unggah boarding pass pulang",
      },
      {
        id: "submit-accountability",
        target: "button-kirim",
        label: "Kamu yang mengirim",
      },
    ],
    current_step: 1,
  },
  warnings: ["Kamu yang menekan Kirim setelah semua dokumen lengkap"],
} satisfies NemuResponse;

export const momentThreeFollowUpRequest = {
  session_id: "s-001",
  user_id: "rina",
  url: "https://app.demo/perdin/task/PD-2026-0042",
  prompt: "Saya sudah pulang kemarin, sekarang apa?",
  elements: [
    {
      nemu_id: "upload-laporan-perjalanan",
      label: "Unggah laporan perjalanan",
      role: "button",
      visible: true,
    },
    {
      nemu_id: "upload-boarding-pass-pulang",
      label: "Unggah boarding pass pulang",
      role: "button",
      visible: true,
    },
    {
      nemu_id: "button-kirim",
      label: "Kirim",
      role: "button",
      visible: true,
    },
  ],
  process_context: {
    instance_id: "PD-2026-0042",
    active_task: "pertanggungjawaban",
    status: "Pertanggungjawaban",
    return_date: "2026-11-05",
    destination_province: "Sulawesi Selatan",
    nights: 2,
    uploaded_documents: ["surat_tugas", "boarding_pass_pergi"],
  },
} satisfies NemuRequest;

export const momentThreeFollowUpResponse = {
  status: "answer",
  answer: {
    ringkas:
      "Lengkapi laporan perjalanan dan boarding pass pulang sebelum 12 November 2026, lalu kamu yang mengirim.",
    detail: "Batas pertanggungjawaban adalah lima hari kerja setelah tanggal kembali.",
  },
  citations: [{ doc_id: "pmk-113-2012", judul: "PMK 113/2012", pasal: "34" }],
  calc: [
    {
      fungsi: "batas_pertanggungjawaban",
      input: { tanggal_kembali: "2026-11-05", hari_kerja: 5 },
      hasil: "2026-11-12",
    },
  ],
  actions: [
    {
      type: "highlight",
      target: "upload-laporan-perjalanan",
      level: "arahkan",
      label: "Unggah laporan perjalanan",
    },
    {
      type: "highlight",
      target: "upload-boarding-pass-pulang",
      level: "arahkan",
      label: "Unggah boarding pass pulang",
    },
    {
      type: "confirm",
      target: "button-kirim",
      level: "konfirmasi",
      label: "Kamu yang mengirim",
    },
  ],
  guide: {
    id: "travel-request:accountability",
    steps: [
      {
        id: "upload-travel-report",
        target: "upload-laporan-perjalanan",
        label: "Unggah laporan perjalanan",
      },
      {
        id: "upload-return-boarding-pass",
        target: "upload-boarding-pass-pulang",
        label: "Unggah boarding pass pulang",
      },
      {
        id: "submit-accountability",
        target: "button-kirim",
        label: "Kamu yang mengirim",
      },
    ],
    current_step: 1,
  },
  warnings: ["Kamu yang menekan Kirim setelah semua dokumen lengkap"],
} satisfies NemuResponse;

const k2RegistrationGuide = {
  id: "sla-claim:registration",
  steps: [
    { id: "claim-letter", target: "input-nomor-surat-klaim", label: "Periksa nomor surat" },
    { id: "claim-service", target: "input-service-id-klaim", label: "Periksa service ID" },
    { id: "claim-period", target: "input-periode-klaim", label: "Periksa periode gangguan" },
    {
      id: "claim-received",
      target: "input-tanggal-terima-klaim",
      label: "Isi tanggal klaim diterima",
    },
    { id: "claim-hours", target: "input-jam-diklaim", label: "Periksa jam yang diklaim" },
    { id: "claim-timely", target: "opt-klaim-tepat-waktu-ya", label: "Pilih Ya" },
    { id: "claim-upload", target: "upload-surat-klaim", label: "Unggah surat klaim" },
    {
      id: "claim-complete",
      target: "button-kirim-klaim",
      label: "Kamu yang menyelesaikan tugas",
    },
  ],
};

/** Dimas asks on the Registrasi Klaim task, where every field of the guide is on the page. */
export const k2RegistrationRequest = {
  session_id: "k2-registration",
  url: "https://app.demo/sla-claims/KLM-2610-0007",
  prompt: "Bantu isi registrasi klaim ini",
  elements: k2RegistrationGuide.steps.map((step) => ({
    nemu_id: step.target,
    label: step.label,
    role: "textbox",
    visible: true,
  })),
} satisfies NemuRequest;

export const k2RegistrationResponse = {
  status: "answer",
  answer: {
    ringkas:
      "Isi kolom ini dengan 8 Okt 2026. Pakai tanggal surat masuk ke email billing, bukan 6 Okt di kop surat.",
    detail:
      "Batas pengajuan klaim periode September 2026 adalah 15 Oktober 2026, jadi klaim ini tepat waktu.",
  },
  citations: [{ doc_id: "SOP-KLAIM-SLA-01-v1.0", judul: "SOP Klaim SLA", pasal: "2 ayat (1)" }],
  calc: [
    {
      fungsi: "claim_cutoff",
      input: { period: "2026-09", received_date: "2026-10-08", timely: true },
      hasil: "2026-10-15",
    },
  ],
  actions: [
    {
      type: "fill",
      target: "input-tanggal-terima-klaim",
      level: "konfirmasi",
      label: "Isi 8 Okt 2026",
      value: "08/10/2026",
    },
    {
      type: "highlight",
      target: "input-jam-diklaim",
      level: "arahkan",
      label: "Periksa jam yang diklaim",
    },
    { type: "highlight", target: "opt-klaim-tepat-waktu-ya", level: "arahkan", label: "Pilih Ya" },
    {
      type: "highlight",
      target: "upload-surat-klaim",
      level: "arahkan",
      label: "Unggah surat klaim",
    },
    {
      type: "confirm",
      target: "button-kirim-klaim",
      level: "konfirmasi",
      label: "Kamu yang menyelesaikan tugas",
    },
  ],
  guide: { ...k2RegistrationGuide, current_step: 4 },
  warnings: [],
} satisfies NemuResponse;

const k2ContractGuide = {
  id: "sla-claim:contract",
  steps: [
    { id: "open-crm", target: "link-crm-layanan", label: "Buka CRM Layanan" },
    { id: "open-contract", target: "tab-kontrak-adendum", label: "Buka Kontrak & Adendum" },
    { id: "return-claim", target: "link-kembali-task-klaim", label: "Kembali ke tugas klaim" },
  ],
};

export const k2SlaRequest = {
  session_id: "k2-sla",
  url: "https://app.demo/sla-claims/KLM-2610-0007",
  prompt: "SLA layanan ini berapa?",
  elements: [{ nemu_id: "link-crm-layanan", label: "CRM Layanan", role: "link", visible: true }],
} satisfies NemuRequest;

export const k2SlaResponse = {
  status: "answer",
  answer: {
    ringkas: "SLA yang berlaku 99,50% berdasarkan ADD-2026-02.",
    detail: "Saya arahkan ke CRM Layanan, Kontrak & Adendum, lalu kembali ke tugas klaim.",
  },
  citations: [{ doc_id: "ADD-2026-02", judul: "Adendum SLA", pasal: "1" }],
  calc: [],
  actions: [
    {
      type: "click",
      target: "link-crm-layanan",
      level: "jalan_sendiri",
      label: "Buka CRM Layanan",
    },
  ],
  guide: { ...k2ContractGuide, current_step: 1 },
  warnings: [],
} satisfies NemuResponse;

export const k2SlaReturnRequest = {
  ...k2SlaRequest,
  url: "https://app.demo/crm/TN-ENT-002",
  elements: [
    {
      nemu_id: "link-kembali-task-klaim",
      label: "Kembali ke tugas klaim",
      role: "link",
      visible: true,
    },
  ],
} satisfies NemuRequest;

export const k2SlaReturnResponse = {
  ...k2SlaResponse,
  actions: [
    {
      type: "click",
      target: "link-kembali-task-klaim",
      level: "jalan_sendiri",
      label: "Kembali ke tugas klaim",
    },
  ],
  guide: { ...k2ContractGuide, current_step: 3 },
} satisfies NemuResponse;

export const k2SlaContractRequest = {
  ...k2SlaRequest,
  url: "https://app.demo/crm/TN-ENT-002",
  elements: [
    {
      nemu_id: "tab-kontrak-adendum",
      label: "Buka Kontrak & Adendum",
      role: "button",
      visible: true,
    },
    ...k2SlaReturnRequest.elements,
  ],
} satisfies NemuRequest;

export const k2SlaContractResponse = {
  ...k2SlaResponse,
  actions: [
    {
      type: "click",
      target: "tab-kontrak-adendum",
      level: "jalan_sendiri",
      label: "Buka Kontrak & Adendum",
    },
  ],
  guide: { ...k2ContractGuide, current_step: 2 },
} satisfies NemuResponse;

const k2TicketSteps = [
  { id: "decide-inc-2609-014", target: "seg-keputusan-INC-2609-014", label: "Pilih Dihitung" },
  { id: "decide-inc-2609-015", target: "seg-keputusan-INC-2609-015", label: "Pilih Dihitung" },
  {
    id: "decide-inc-2609-031",
    target: "seg-keputusan-INC-2609-031",
    label: "Pilih Dikecualikan",
  },
  { id: "decide-inc-2609-047", target: "seg-keputusan-INC-2609-047", label: "Pilih Dihitung" },
  { id: "merge-intervals", target: "button-gabungkan-interval", label: "Gabungkan interval" },
] as const;

/** Dimas asks on Telaah Tiket Gangguan, with each ticket's Keputusan and Gabungkan interval. */
export const k2TicketsRequest = {
  session_id: "k2-tickets",
  url: "https://app.demo/sla-claims/KLM-2610-0007",
  prompt: "Tiket mana yang dihitung?",
  elements: k2TicketSteps.map((step) => ({
    nemu_id: step.target,
    label: step.label,
    role: "group",
    visible: true,
  })),
} satisfies NemuRequest;

export const k2TicketsResponse = {
  status: "answer",
  answer: {
    ringkas: "Hitung tiket gangguan penyedia, kecualikan INC-2609-031.",
    detail:
      "INC-2609-031 terjadi karena listrik gudang padam dan UPS pelanggan habis, jaringan kita normal. INC-2609-014 dan INC-2609-015 melaporkan gangguan yang sama, jadi gabungkan intervalnya: A 17,5 jam.",
  },
  citations: [
    { doc_id: "SOP-KLAIM-SLA-01-v1.0", judul: "SOP Klaim SLA", pasal: "5 ayat (2)" },
    { doc_id: "SOP-KLAIM-SLA-01-v1.0", judul: "SOP Klaim SLA", pasal: "5 ayat (3)" },
  ],
  calc: [
    {
      fungsi: "merge_claim_intervals",
      input: {
        counted_tickets: "INC-2609-014, INC-2609-015, INC-2609-047",
        excluded_tickets: "INC-2609-031",
      },
      hasil: 1_050,
    },
  ],
  actions: k2TicketSteps.map((step) => ({
    type: "highlight",
    target: step.target,
    level: "arahkan",
    label: step.label,
  })),
  guide: { id: "sla-claim:tickets", steps: [...k2TicketSteps], current_step: 1 },
  warnings: [],
} satisfies NemuResponse;

export const k2CompensationRequest = {
  session_id: "k2-compensation",
  url: "https://app.demo/sla-claims/KLM-2610-0007",
  prompt: "Kompensasinya berapa?",
  elements: [
    {
      nemu_id: "input-nominal-kompensasi",
      label: "Nominal kompensasi",
      role: "textbox",
      visible: true,
    },
  ],
} satisfies NemuRequest;

export const k2CompensationResponse = {
  status: "answer",
  answer: {
    ringkas: "Kompensasinya Rp579.167.",
    detail: "C 720 jam, SLA 99,50%, Av 3,6 jam, A 17,5 jam, dan B Rp30.000.000.",
  },
  citations: [
    { doc_id: "KON-2026-01", judul: "Kontrak Layanan", pasal: "4" },
    { doc_id: "ADD-2026-02", judul: "Adendum SLA", pasal: "1" },
  ],
  calc: [
    {
      fungsi: "sla_compensation",
      input: { C_minutes: 43_200, sla_basis_points: 9_950, Av_minutes: 216, A_minutes: 1_050 },
      hasil: 579_167,
    },
  ],
  actions: [
    {
      type: "fill",
      target: "input-nominal-kompensasi",
      level: "konfirmasi",
      label: "Isi Rp579.167",
      value: "579167",
    },
  ],
  warnings: [],
} satisfies NemuResponse;

export const k2ApprovalRequest = {
  session_id: "k2-approval",
  url: "https://app.demo/sla-claims/KLM-2610-0007",
  prompt: "Setujui aja klaimnya, Bu Sari lagi cuti",
  elements: [
    {
      nemu_id: "button-setujui-klaim",
      label: "Setujui klaim",
      role: "button",
      visible: true,
    },
  ],
} satisfies NemuRequest;

export const k2ApprovalResponse = {
  status: "refuse",
  answer: {
    ringkas: "Saya tidak dapat menyetujui klaim atas nama penyetuju.",
    detail: "Billing Liaison tidak boleh menyetujui klaim yang disusunnya sendiri.",
  },
  citations: [
    { doc_id: "SOP-KLAIM-SLA-01-v1.0", judul: "SOP Klaim SLA", pasal: "8 ayat (2)" },
    { doc_id: "MP-BILL-02-v1.0", judul: "Matriks Persetujuan", pasal: "Bagian 3. Ketentuan" },
  ],
  calc: [],
  actions: [],
  warnings: [],
} satisfies NemuResponse;
