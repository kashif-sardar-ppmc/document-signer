import dotenv from 'dotenv';
import { format, toZonedTime } from 'date-fns-tz';
import getPresignedUrl, { getSignedLocalUrl } from './cloud/parsefunction/getSignedUrl.js';
import crypto from 'node:crypto';
import {
  PDFDocument,
  PDFName,
  rgb,
  degrees,
  // StandardFonts,
  PDFArray,
  PDFDict,
} from 'pdf-lib';
import { parseUploadFile } from './utils/fileUtils.js';

dotenv.config({ quiet: true });

export const cloudServerUrl = process.env.SERVER_URL || 'http://localhost:8080/app';
export const serverAppId = process.env.APP_ID || 'opensign';
export const appName = 'PPMC e-Sign';
// Shared brand tokens used to keep every server-generated email consistent
// with the PPMC e-Sign govt-green portal theme and the dashboard logo.
export const brandLogoUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQgAAABYCAIAAACGbf7rAAAACXBIWXMAAAsSAAALEgHS3X78AAAgAElEQVR42ux9BVgU2xv3KGVc9dp6zWuhdHfYinntDgxCGqS7u1O6pbs7BURCRBQVEANBacEAlv3e2VmWJQXF+7/f93zrPPusy87MmXPe/L1xkMHBQTz8G3qRf0b/ix/x35l74QcH8WO+wuMH8dO5BH68y6Iv3JR+PPzCEU/FTzza8S76c0+OH/Hs6FPjJ3pw/IT/+dFDkS0cfsyj/sRijV2yycaGPRF+vCUmGwhuiis7ND/4SSbnh7NH9t8pXAqPR351nXEz9JtJZweHww0PmUjC+J9jqkl+OURM+J+im2my8LQvMj0pM/464H5pRX5i2JM/OX7KtI4fnN7S4H9+PomTifzk1XETTy4ON7M8hsPN2DL+NNNOOIYx80D+y3EnEE+uf3AzJ01+8+zh8fjB32M9TE1s4H8X707wQgb/S68RltuYFcX/7tvjfs/jTCynp0K1I36CmyEZ9B+etOlMx28cHoL/DdT9m5gbPxMicPzTcf+LNf6FO+L/teHhBqfiFUzwOPgZnxP8v7UyyI/5clqE+D+SYdPiFvwUn+JXnmX8c//XAn5Sy218cwX342/wMwpO/A/slOmaUvjfRsS/yW3AzwTf4v8lJsf9qxbFL9wfPx6uNRrJxP33jK5fozRk8P+/pkoQuOlS7VTRoqkQE+4XeGOIlAlkgvufaKdpeM+4SSyCf82S+m2Mgf/XJSz+P+CM4mYQMMCRCPp3wTVTlAtEfBw/OPjfNn7+k4xBIIhhTAkVTLiZRXVIF8f/zsnB/SwN4X9lIXE48ijaVK+DmywCix83AIebJiPhxg+P/fDRsFH9bHQYN/MRnGkKETyKSuF/jVP/RSGNn3HJgcNN5ZI/nNAJKWC8ycGRlBv+R/Es3IxOFH7YHyAf8BQZEv8Td8dNi9rxQ3IQ95tgtVGxXdykLIT8up6aYU960qsN3+s34Wa432O04P6tU3G/0dAgX2jcD9cdN5PGHvFeo62GX5rN0eJsxOMMMQZ+ynQ/+XSMFYIDOFw/bgCOvoF+OAif0feBiS+En8yHG/z9JvVUXRr8pGkm+BkxnccTBKOHOvFF8L9uCo63Svifz42ZmfgvfrrB4klNRPzM+hiT3HiAwAZA+fgfvgbxKKsQfvy/dbvwv1UD4KavYHET0CXuJy2c/1ZA+n8xvGnpLmRGPVdUOQzli6Kvvv6+2tbXSfWFXtXxVqXBRgXexoU+juVhobUZhe8eN39uI5qWhBew08DgwEzpyl/PBBwvCRP/66YRfpp2/OQu7M8J7181b6YbTp1RtsH/mpCc4rMjPzcLI1Pl0P8CWZNIvKqlzqw48GyCNruvKKfntUMh8uditW4lm0imW0pmWF5O1D8WrizgfXOH51nBKMk7uRYhz9M6vn4eYg+4FO53+zb4HzpsuMGfSaD8nwjdcbQKbgZSdnETIwrTTljC/a8mByOSnwj0zYDGAC2BIwi29q9dNo9CBe5LcvreFE8w96iILXhTWdhYGVubG1qT5lse410a4/owLOhJYuTzjMy6ktL3NfGv8vUeeB4MkWfxviSebfa49QWWxYleEzfOyqDxqRkBgqdFNCMc/f9wJsv/Or9oRsKj+P9GAAr5lYkmKArUkWj70qWW47rt3rmzsToRz3NK3lX7PUm8mWTA4np2ucXu5VZ75lsILLffQ2PGyeR5jsqCa7453xJTwTWme3f53jZ54BXxPCOtvljroQdr4JXT0arVn+pQ1TEIZtmvJvfhp28N/u7Vmjq6j//vEdA0nGD8lBhj2kbd73dm8D+sx5h8McB2wubIvTJm471Tl+MMHrx9Ev8y/1KE+hJzodVOB1m9LlIYsS805Ut8kWf8wMu/Okk23Truec6tZEO7omCJeONz0epHwuXXuhyiMuJYZ73PKNe9oLHcqMBri88ZrUI3cN8xx+M3TtO/7jL+t1xU3G8cLv6n5/nHhSUzZsvhZs6UwpHMJ6Daps+tB4NkWTyvZDQ8ynhRvMf39iJb4YXWAogBk0aWY/qropV2exZaC4Y+TS16V+ldEWNXHKSUYmFbGpjXWBZUk2T1MEAz2S7xRf7pMOWT0XcpLNiWmAmY5ngWvnl8NFKRI/Dqs7YGuEv/wMDvoAH8dJyz0aoWN/6M42eEMmYm8+9/5PNMGrj8UfI/7t9WjxPfEfmJxegnyPKCt5V/2R5RSrWvb31/OU4bMWHZaLffrzJONM4A0ae7nqBT3FjpWR69yFrQrMjbrTJSJcteOdPOtypWNdveqSQ49kW2fu496UQT6QxzwweeQU+TT4Up7fG+hWgz0rmdzKwrtir2X+V6MLnxwaS8MWMzhp8A1Mf/rNn2P8dS/0vJTTP8UKAyUAxz7EEwvzH8hux7HG5w1DcDPyT1aTMGpiviXxUstt4X+Dg179Wj1YZCSw14JZNM9ArcjPLdrR8GXIhR4/G67FEWdTVWZ54x90JzvtkGjIghM4UhyzwjTgodxjkG7HTuJ1l9L0skGl+N1HZ5GGJe6B1YlZjbWHo0VGGxIQ+FBp1NUWBCfcFq90MB1Ukob+AG/gXhh/9P1TD+f5YYjxrJ8c+ffo3KSx8rxZBRqNbkEw2SGy6aWJu/zHJfRn2pX1UipQkrv+dlzXTHordVGXXFHo8io55mnglXQbS2URmy/2kmKOAnej1B1zTPyyTPUz/HzSDf3aDAXTbNktvj8nKznbM06f8w4ZVOtTDIuxf/PMfygZ9GhpNxnhe79yVEi1Y+xjz9RfEql4Ox9XmT8Ab5o/77JEU2p/iZ5czp2hv/Qu31+BgMQX5PMaEd/8u2JKx157eulx11tR0vXnS8QN/bXzxHj5fP2l/VtL2sboXj1RP0qIP3qk/o8aStDo7q9vqn7fXvuz+SPGQsOWOcJMKpjwkDoKo/1a+0OhD9NNu1MAzRYuDyuGSQ7+H8MMShMMj/SeLJSOW5Rtx/GvNdiFADiPZNxwcs/h34NPFQxJ19oWIHgsWO3pcGGAq+hL9Gvsg6H6s+V5djrgqTsNdNr8oY7/K46OdZYU/S6GxOIHLrpBPMUuuL17gcLm2qGeWLw0rAN61fOg6HKiS9KBj91zGvAfL/TFCZhhsc//cDE56FeYJDx4/Sh3A/GMMwsAH2KvHAEd+nhO3+pGMwIepIyN/BDiyXZ/QwyClsQk/s11HsofTtr/3f7lV58UXsWe+1fZ3X1nU+W9b7bF3jvnWF29bF92jnu9JSOG5H7HcgdoyIDRNixYxYsqCHBbyzIhassyzYEEu2WQ68vjWJcLV3nz+0fe3AomdTM6XGjAyj76/935kdzljlB8TU5Pxhxn80QDq0PPX+40SHkvuGOZ7rrfdT6LGIxus/b3tNaiqBMkDXh5V2QlTGzAssuP+w4EZMmeh8Tn4b6MN+A+8vP725k2hKbcVD63ZSIdEq/025/YP7pjleYknGiNZ23SxX90dR9K5nP3//Aj/GjRwScP8CQwGP0miiSiE9IVkAflxVSiC+gVE5SJO/UEIZk+Q1VkFPUq0+VqGPktMkOhv3NRTemVIsfOrJyLgxGROYEpjICBkWQIQp6+77XN/5+kv/V/xvLtqA66s90F5572/xDNmourjk+tTEhpSk12lwJNSnxtWnxtSlRb5MC3+ZFvYiI5RwhNRmhtZmhjzPCHmWEfI0LfRZRnBthmrpvQ+9bcXNj7f47eGLOPugqWIs/jmltHP8kGshm2Z9Lkz9wZvHm2yP0TmcvJNoAvZP7usyw1z3xYZ8m20Op7wqwsgdSw/5TqD+0JqU+Rbcq2x3LbMRXmG7c64p56lwRcylRlOqBonCIPt12TarI7O1WMSSjf0eJ6inOwC3IPosiMr24PLkW/FGEimm5A+A0VlTz6eV1iK+5fHkthaM4Gvf984vXR09XW09na09HR+721q62po7P71vb4Gj51svaZlJZAEJLJ1fujt64ZSOT5/b4ZTmrk8f4Oj8+L7zY0dvN36IdQaGBBg8YOfXz3BW19ceeO/9/mVwwh5w6IS0fels7e2A41NvB3xGld5w9gDKpqj0GfhW+v6JR1mITo6tfIqBWqqpc6lvdsODtt6OiVT/zxb6TlwRShjJh57mxLoku1J7/QIDowJTz8e+JU2lPd97SPMGH3LeFOwPP8HiJ3A2WvRt17sp8gZ+moYcxqWpbzJX+WyyqXQk1Xv8jHdBWMQvA9/2xt9c4s61xJlrhZNQzptHo3gDmboRVfT2CZ3D6aKGqn0+knw+opY5PpGP0+0KA8USDJk8zwh4XK/79AajTtLKYSdKpZpSGbOusBBeYi64zEKYwpDNoyKafBxYBi5809LTvjdIAtGid3gQfDFE7W+rwwbZ7tstTiw13AkgGNO9c1l1D0l0iS0eaIxlFvvAACNdEAPNbLIC/tLeT2tycpP+0b+1D2/UEtmgLbJe6+Aa9X1rtQ5sNz91yEPGMTsYWAXN6SKcEluds9HgyFaD45t0Dm/UObRB++A6zQPr1PfD+1rtA5v1jwjZXNdNcnn5qRFliX6U54MqkzaaHKK3P01nf3qz5TEhb7GPXzow3YIfg1j4VMZutD1I73SCzv3UlntH+f2udX77TNCBRPH8rf+7b2X0Tt/LK6y4/jBmWGjMsMCYYZEJ42JThuVmjFwehyweOH3qbcWuP0UnYWRx9riwMn6sYO741mFWbCkYtJPWnX6rG/1mlx0bnXasc6Td6MS4L+CkZ3lA19duVFd8/ywYeOQvezr6e3yLbTZZlDhNFHqaCtCHn6DECivKRdVFkTZ3uHDX925C/Hdgik42ltxNPAb6YZLhe6sy70XO7Ovcd6103YOYMSmkmhMkdf80GAM35PEcCpSzKgi0fRA4z0Rgs/3RmJrsqKcZpvne+31vHw2Sqe94PxpXJRTEfO7rZfE4v8CUd4m5MPjif5jwrbLZ+7L9zbBhN9KzB8G8x/M2gLY8Htfc80Lkwk0uBqkid9ZIR5u5FoXt9b1DIgtsst51f1xqtoecMTAqV42yQ65tpJRhRe4wIxJMiCQTIsWMHnewg3GWBB0iRrtO/1D8szxsEn0fxCA3ts6G30gSfi8xdNzBzmWaJUmHSNAuVOWzzPTFSNnpQSiiTEehzYmosVGosyOKtLKx5tij4QeHDQ/UXGx785fVXkSPhcqQi9qQE9FnWut4oIPAGBjb1H6qFwm8Ta3P8IcByypz3jWWfGst+dZbC2yw5t9ozbvRlu8vW46lluDUiaTX5ZLzBn7mEgSHlHDT2bhLG122MXiws3rxMnvyMHnwMNzjoXflpXXiXmlNt96V7VUHGmKq63i9zZV3qysPnavgn5ZbLYqcZyruNFxSS+ZPimfLnEi6gJkYsMqN3W/quxrgqOtseNXZ8KK9vraNcLTWP29reN7RCHGwTwQ1S7RKBvGYpH7aXve3776VLgIrHIQXWArOtxLMe1s5bY2BrWv6qxI+jxvZr0rprU8d8JKyLgi8GaXnVBp6JFzmaLAMWFMYw+HJFDR2YtbrhwvNBP40FVxoAu9Cs/XZD9+XI3cVxt4LaH2DqQirw3nLPF/ee9f1su7t97xDpcmd+Cx/p5d4wnOinz3MGKZ7vR/FkTgN0xhasU7ITVoaeR5KGU5KGQ70kOWklOOEdyo5LhpFHiolbmplXkSBhVqONboyC07xfxiPyLFSKXCjP5ZmRw/iWRxUcpw08lzUilzUd3ko5dkRia0GaffgFJficESVZb4O/1xN3rk6vDTa3FQa7JlEtTaALS22GOciVREd5kWmIBr4F5jyzzHi/NvxUBvIXQL/VDbXbrY6QKVJv8KYf5kRzwpj3lWmvMtNOZaYsK4wZ19vzfO3Hd9GO97N9vyrrVjWO3JF1iaR1nusCEatMhwIPxyeLMVzfPB+TMsCkMSiyeJ/O29n8+Jn9OD+25lxgyPDRiemdQ5Mq+zoNzlzLbemty12J6ROo/L1arzcAvNtf1rR8fkcb+x8R+DYIStgGD8YIEs2JYYUSNJtYAjbGAU8jAVaxLJkTiVdxD7nvSug92VlCeBg8GPb4c2y2YPlL1fWpU7sCxy55zjwUtny0dgIISbsR8Pvkk0UkfMvJistdOBY6bhzic1OEFXKaXbj+Bg/5FviugarG2V4mRb6ztHnWWO+P+JxWn5d2dkItd1+YlZ5/kNcgVpwpEFgVK6e5Yzosi42EV5gJLDIWAg+uz2KnAh7JVk1gAgjagwcbleCypLkIs1NM70QRYY78eY2+YFnQtUwHiAyRtfHpcZ7hhgDaJGoMTRRxthGJcc9W5p9thT7bEk25A4LIgUHK0EDMFAoclLIc1ArcMPnHSb/wL2DHyYit+gpZNhnwyHLMUsGGIAREWNENYw0HPQUiuwUihxUSpyzldjnKHM2tL3zKYtHVBjm6vLQaHHDAbyBqDFzu13tJXiimLOOWlxVibMN2RaY8M8z4plnxDvfhI/akH2jg0j7ly74a/PnVia7E5QaTEv1eBdqcy7V416gy0aty7DJfo+gxzl2l6OrrNiXWjJttOfZ6MCzxUngD/NtJ8Nv9eH6xlodBO8AR25IkHv8k+NagDihM1+XuvkeI4sXL4MH91Y3VskUxYyGnLKmysS6DPU8k02OPLsDz/T0fSGai2ARfOsJeRIX+Diq9cuwbB7ruBNJHz8OVjE8vCEGIB8wYcx4ImNkS59IvIBdprm3xfupr9dTX48qb/cKL7dyb6dyX4fKANuKQKvyIMuHQVYPg01KApIaikjXwR4w5EXiYieO1faCS8wFKHQ5GF3PtRPMwlGoBjKyXnR83Vrf/p7N5WraqxIW50tsDpeY7E4vMeQ3zvFgcjpzzF++m+DIjqsKAVxjc79Eqc+10EjwD0MBGn2eFRb7GghG1yQNNTBWPB+sttR0n0Ne0P57UmopTmyOlzeZHI6uzuJ3v/mq9Q3JAgEfY6kRaIxYItPjiIyhHecMGoNKnhtEPiLOwGp0tur9y7I3zyvfvsh5VXbGTxWRY6FU4gL2oFTmQe7QxT/JiavKQSQZKBQ4KeAUCaZVKnvSnxVXvXtR8fZ58esnyjG2c+D3KhyUKpw0qjyI5FaLDO/AJymIOuNcfV4aHR44qHV45unzwzeGWR4EJu/D4IHNTsfAfPoDZQw+jDGo9NnX2xxs7e2EH9yJMUYUaP/U4p2vwblQk4tKg3mblYhvWfT7rububz3tvZ0P3z++Hae6yoJlrQ3nMhsm+Uw9MO4Jcz6qTyAREnjVXhNc7aqXLyWdclo84dTd9Nse5U6v2l8MES5+EjtKJVt7gzMdi5fA3y7M52JuYJNMtPQBrP/4vKKlmiiDwO792vWqo7Glt7Xpcwu8EyFvDC383BL5PNXhoZ/bo/uPmp5gZtGHnk8v2xtftDY++1jfSSg0gJ/Vtje+bIUvX3/p+4a6su+r3B6FOxeHZDWUYnfHoHD4cDtT6kTixaF28dMO56FObG8re8CxZTacyy34Fxryz9Zkj3mWM9b8ww91OycqMtyYynGMRu3ygs76qPqXJ1BqsB8PVAh+nBJQmXA324HO5XRYVfoorwVPpi5yGh7NMeSdb8g3z4B/gZEgos16KlSFXLWNa1ZiN61sfjHLgHu3t4RPUZRXcSSMAVFjBVj2UpCaY0EwSbegzrfBHu+HsdjjwYMMM8YtWtQukuNCxOmFrW8QJwiPoUn9/E43EDkmKiUwkLiRG5sME90Sa/IRSXoKOXawncCpWK97qOVzG7kkU0t2RBTpaNR4qFW5EentlwM0IbUe0WKZawA8z0ejx0ujyztHj5cSpW/esvc12KqIpZggRmwLzQTnGvHNNeSFY74RH6Uu+1qrg73938CVX6zNP0+Nc54q93w1rtl3megtj9W1vSUHXrAx36sI+tuN370imCRfyVFmjBw/fmmyfah2KpL9QBDt0fuMh+8zHwxm3RXAzOO9fVcgd/DTgIlQI9zQ5F9PktrkysLoxr/GllEyURnjAQDfQNxiazpIVn7jVOa/zpGH6d6BlbYcmnnW2DC+4/psH/kwuIsstmZfYM7yhznTCls+mWSjr33fToUrrLHfs9n50Hqn/Q8/VMOlDt6XXGO3b731ATrHE2mvim7E6C6xEJpjwDnHgGOBBf+5cOWWz60kPryVKf1P/IVhpHs6jIGpbo08yz9tmFdbCy4xFkDUma6GaxMtcNzIInX8BKYUwQboJ9nxp4JVbQvv30kwonU4FV2dIRVnss3uH0FP0YM+kl0Evh9Vt0TCYdQznBAtJmCJuQb8oDEQTVa/ysSxPvpY9sAI8aC31GaTo17FUYbp7pdCtZcZ770aoetcGHbWX4VovGEaQ3+IMVDzDD+CMUBjyHEiYnQCFlfgPgAlwdH7DbVzpO4bI7e2A1dQK/Egt7aqRtlEVWUjEvSU8pyU8lxgPq3VOtjYjgYov/V/6/mOnhJZlYEo0M/R4KVW40Zk6Y55K3iUxyBarHOBK3R4qbW5abR5qHV54L+INsvBIBk4Je5ZHoU2+3x9vrl6vPP0eEG3AGPMM+Kn0OX8y1oELD/rLD9Ehm6+MjeNIgeNEjvlXdbU2kIMoSJFArG6SCC4V52NGBQ+Rt+i01XXWS2dtv942NazUZwnw9lFgnYcDmHeE8iwN5DtQDCfoD8nqzdDakMqyUMbDl6CMBrSNtcTZNY5MO9w5d/iwL3Jnsv5kc+3ge8kc4jAHsNqQSJJc7El89+OwvPN6R0foRZ1z/cvN+JUgRlW2/D+bb9rg/2uNXbCf9kJzzVjlUgyYPM4u9CMZ4k531r7feAWf+xp32B9cLGJwCIT/o1Wh1idzs/T51lruX+N5f7V5ntXm+4Bc/p6lA4RzEAZQ/Z44iWMNqrbai6liV5OEr2YeP1ivOjZuOv/xNw8HH17X4T4zlBxoSBxoQBJds/r2ln3CISBkkTxh4qNLrxrrXmXGfJRqbCvNthT3/5uIgsTGb80niSoBvEAz7NZX0x9WSzoeZPe+mRoVUpu/aNdPrf/st9vnudLTuWkngA4orfQx3HvyixtjvkGgvMMBCh0uNdYiLzpbMYTCBTrjdBH5mORW3gYX/mDBa9IJxqi5/YgIqX2AZ3l6V1eYpFV6YL3bvf0fcUGiTrfxkTnu58MrtWOc8FMKSqg8ls7hM2vkatU0OOM5ucQGWYqRXDEuZHrmy2SvRKe5oNuIXjeHIg403otkZbuNpJshg+SESbgadCogNcOWmjrNT9Nz7JYcCrm6AJX8FDp8FBocYLSQM0qXT5Emdkkw5Pb9SqizjJXFxiDj0qHi0aXZw581uGbpc72l9kB0Bin3BURse1zFTjnyIPJt2Onw02UDsYDdjBaHJgg9vrxy1uF9H0Xo+luJPCeimC6ErvTu8I2rzEl4WXE1fgTAv5sOwP4WX1YbqXexjT2WLGKAaDWRS7LLLbvcBLY5MCz0Y57pSWToPcpu0KvN53viSDbwHCoe3/QtZWWnBttBFdYciS9Qm0S3VyHP0yZNtgKr7MWWmrBvdCS8y9b4T/NeZZa8IH1sspCeJXFzoXG3PxeV2C1QamuMNm1wmjXcuOdy0x2ghc6R5+bUodjkb7AcuNdy4x2LjPatcRwZ3VzHTbCW1lyxxMuY8/7+FP12aSr5xKvnku6fjYBuOLqoahr+yNv7A67JRR8WyDgtmCABKvHVfVMZ6IeG/h+POLmCmu21ab8i7R5EVl614LQsb4uiYaRcT3g4rePPYrDEl/mwxVL3lYL+UiCN8zscA5RY6Q24mF0O7/XU2KZ8e6sVw9J7jyerDwFU3wQB5xvIAB0MEeHf76eIKLBLuwhNsRy45iApMZ7+KHFrmt7Bx7tES+Z/PoysNnOeCszWpyKfJJx1Feh/P0zImN0fVxisd+nImEUXKsd64yIos436mNIMNIZnoityoooT4+szHDPj+S3uY7IslAqcFHIclDJcsAPChoqYyqyENEdlHfYKe7AN8zLVHZ5F0XHVGRGPkoLLk265KNOKceOeiByHIBQgfXllB0U9DgFUIE5WrzUGtyz1Tm32ZxaoC9ArYM64vANpTo7jTbvHG2+ObASauy0tieXme6jUOeao86L3GVdayTS8rldwPI6IkZPI8s5B8Ypuk0uxHQSxHM0V+BJbQLx98oVb8TSSifxXotjlkk9+LrzBUlSJtTHcPoxCwTys/iw/xN9CkLUoAPbvrS2f21r+9LW2tv2sfdTc8/HbkLk7m1XE5f3oVXWLFvsASnm3WDFt8yEdb4+3SabXSpp5u+7W0jeHfgVdE4HV5nzwLHOUuBtZ9OTj6/W2gqvtRJaYyn0pwkni9vJoOrEmk91EAXmc7+42JR3JTCGmTC1HsvVSA1U8FUkLNDnX2G0e7nBroU6ApssjmimOpvn+7K5Xv5Dl3+Z3k445mnxhDxOxdZaNE36aMxFUvozqu0IxvPAUIINDsvZwA2OZHiUlpwr/JZY0K+14Fuqi3LFHpdbmFT92Ns+LkaKjCt+AqviIQlKNFG/b7A/tDL1uL9SRE36Eh0B6TATi1wf6QTzTVZHN1gexUAV3BjMD1N8upnuiArzHzqCc7T45mjyUWvwLtAVkow2scjyMc/xsSzws8zzM8v2AYochcrjh2x6iF5vMz2+w+KkY26Qa1H4MU+FFbr7AK496qUYX5M/zBhm4zFGjDNybSuVDCcKSaHAFBsamgA8CiCmG9tnAfokzQnQE+C5yA1abqPzeBSVSgKfGzQGhST7bHHW2eIsyG0GwKnQ99s7kJvbKe6wwQHXhOssUeL91NMBJhwix0itzovSuiydaqKjXKIVoko/R5+fEnxxbT5qLV4aLT5KLZ6F2oIxT3I26IogCqzUqryIPMtafZHm7lYesyvILTqqOxzUwI1XtqmG2kxSnoXDjegbhUfNKpRGGzofK6azK6RyyiZz3oxnKm9G0efe75+bPr+rbClTypRn92HnCxTa6sl4MxUNBPlXee705zoQvEcoYBeX3042z52b7DmDnkRhU1rRXM3jcewPI7pVFmHKJMMAACAASURBVFzrLPjXmPH/Zcq/1IiLWptuh82BQgI0T3AgH64y5fvLTGCxCReL2wkYjXyCyRxthrXmwktMeGgdRGpbG0juQeWH52ss9ywx4l9tuotSm1k/2w1FDtOdKbU4VhruWagtsN7kYHnTc+zK5e+fr9bbu1BLYKnurjmaPF6lMdj3V1OkDkVdJO089kNve3DIBoN4C5vHvjXmnMt0uOfIs82X43j0+il8fzlSp+Zj/bgTjpCy58gZw6UohNP6tFiYHnx2LAoVjdCHTh/LDHa6FIbCEwaUxv1leoDLXRQD4MZ14/pw/dyO12apcMzT4J+jzgcwDrUKN+VdTrCnEantiMwORI5uthw9IrVli+lRYgB4TBYQfCniIb1IVdCrINL7QbRTYdgaiyPRT3OPBSh7l8YPm1Im+73L4kczRrQTyhiynBhcSyHFQS3DhR7SXDRwyHDDQSnNCebWKtU9DxvRaQosjkdu0APpA7Y7S4J1tgQrlSQ7RrJwyhxpbmopTkopDqBjYBKPBygZOeWGANpLpcJDo8IL7rhCnPWXvq9bbP5BtDmodfioNHmoNHjmaPEj8nRWOb69fd+Wae1CFNmolcB3Z/5LY2/H156DNhLIdVq4C5UEB3J560kneSKYMSZ+hzkWA6SC36GQBfw+7bXT3Qw6jUxehVRW/byj2fVR1gUq4gnHT0YJ7rnPxenLwuHLvcWNntmPr/gDmvugnCnHdG8blycbvRvLVmeWDQ4sa+yZS5sekyCNlp5W3Rz77Q4H5uowLtRnWwnRFUO+lYb8NOoMtBYHIPsTfuNVFkWjy7zGVHiOFtOFEKXP33vZXE4tMuBcbSpMpcNkXehL8pQGCI4vt+vleVocKwyE5+lyRz7NJMQA1ChV2Vbo7kbusminOGOiENQRnMVhf5lalWuxlhDVXc7Iqixsra+kSItEXsJY4kNPi/tj33tVPm5VPs5l3vYlXjYlPtal/kaFnpATRdo2EbOrVbL0l5huX2fEv1CFCxHbph5jC1+6PoxYoC/4rrNlXDcDGVNqhr4cioJEI7WN8tA4jkmOz+0o45SGB2sMDvC4XD0QKqOe67zJ6vh+H+lxIQ6MtZ58eDlfjRORZZglw4RIAwbKTqnISQWWtCLPHCU4uOF9vjIfIs142ld5hMYYuiYmaS77aYDNw25zwa4gUDfNfanObt/SxLNBGnaFIdhkNX3+tMz0gE9Z/GgfAxjjKkFjAKFLsc26w4rcBoImHChl70Cub50lxrTbVqy66RV2qcDiBFAOFISgBzDGLNAYN+iQGzvQ4/p2OGZd3YKIbt+icSS6PBM7xS0vHILoVHe5ae6CxthxhxD2jn2aS6HMRqUBwT6wqfgQVaYDXuhcga+5XH0XIsNCDe6EFOMK1d19OJxSmBUiSkstwUEpxorcYFwqxf+ypZEUPiOldGLGFQA7oys7CbMd8kxBL5dFL4dHKY1DOpnrUhTjwcCNu/0383lv4fCm5Q1i5w8QvB4v+ehDBUGT9IgmXxYM4N4dsIvPfyeH9046Vz5e7yNthEBEP8HxwxbiQ/cn15L7gh6X52mzLdLhWqTNtQwCNco7rHNRoldMtKBQY1xtKIzc3W6Y6QrpPEtNQLHwLdXjm6/OnldHzD7ClD90Bdhhe3K+Ns+fugKLdYVetr6BuzBbn6VR4VisIThLiQ0mjcSWoEi3Gh+nUuD44y7vnLvcQEtEjZEmtz/yEqYE8t8VbXVno/Vg3+zOtt6JbYUN6yJLjnlmXJAzwel+FQVLBol3B9/pZVsDr+upWfI7KCQYGLSPQiIcyi2p9n+YCoHFQSC/gR9k12L2lnPp/X1+YsqpKGNpp7hJhJmkvi6iszvjVRYDaU7BT1Lo7c4eDlScMGkHnf2vctGW+5wljrrLHXCRWqwiiEizoFaKDDsFvMuisWREmnWpslBN87i6jKiCbwTpgosMppRFjs9JH+U/tYU9S+Muh+lZ5xNRyw+fW5dbHfKpSByfMaQ5UYdBnOVPeX4hC1EhqxuC1jeEbG6dcFOE0HhO7SNiTJCQ+BRYkoCIMQFjUABjiLPMkeXmMbkkYHyVz+yakPVNEXtpqQCTsEdp3V9QW/x7H4rVuOWjjEGpxIMG0WV2SMaYY6NSircBfwxg3Fna3CtM92L6uqnr4zJVYTS4rsgFUZTVuvu+4wYya4qRq3SUt1ln32ahlGAHM+/UPUUifk/CBglT+uTDK26HK4GPEobjZUOzHf5M0jCP/W4ql2Qi+40YpnMhtLfj9ujlSrk/so16Hpr3Lvd1ZyNukFh0CqDI+89Nb7vevu1++6b7XWPX2/r2RnAtcMONzTH26MNwGBiAY2HwIl3eBepcizUhV4DuZiiKFO13F6O6y7JUWwC8rJCK5BefGudpcCzS4l2kybtQnbvkdRVG6FhSWV5d+XxNvj+1BWnUuHZYngC9+qb9w2J1QaB7kJJL1XY+fl9LYoyHjdXz7/LOVQT/kA2S1j4S6BiVkiky+zGNQSCPt93vGjoa6zsaGzrf1ne8qWt/AwGu2k+NIIBIAAN4UxJJ0tHP4nq+ftlldhW5sC6+Ihu7mlaO23xz4XddLROYUmNaw6BUlerEZHHCIM0VPhvlgFNhDcV060wPnfdR0UpxghyNv/T27XWTnDzRmoTxoWlIJXEQGaCU5cAwHwppdmpZLuT2dst037HDGoqgo1c466MMjOGRFxFYFK8b7zJXmde+4P65QHWnwtBhxnA86lM1XOU3bEpd3QIag1KKE0S+oNnVccFvgnFCROUDiuKRm6AxOCiBl24zrlHd/6GrdexZGDKD4eIuqMZATSnUbZDdcSvSGMuJANSSw/UKoskG2JR7ERrphxPA1V5huA9R46BS4wEf4y+tvW29XXA1IcPLoIjATkONN7j1VdoDlrcr3jwjdicnYKC+RfFrNQ8gknSz7jCqxdhhzE8ypQIeS8kkMcomc4vHsaimH8priG3tbZ4wzjU4bs4pcaWyX5aEV6aQYEmUPQj8wmN9EZFjWKQOSn67RKgh/HWTwSEqBdb5d7nnKnFUvnve0PZ+njr3fHWeRRr8iDSdeYY3ycGAK58KUEEUWRapC4IRccQdBbJTagohZDRPkQckJq3B8V4CzIjNalhFOuDmfyjwAs6+0/ommOUYlV9Klj0QeXkqcQxSdY1ujvYWO/o11qxORUGtnzvvPQhH+8QS7qKW4TzPWGhixhjPEHIpun8rWscs1xON7uXfvxKiF1aTscFM5FKQumdJVCbkTTlf3251CvP3cRO4iUOZS+gg8l6WUktxQKoFIfuIgxqCbmL0QtaiaF76uOUfROmF4zS/uEZ5t0WaD3jeq/QOwOQ65gUf91YMLEvClq6p+9MyYIwnyaOya0kaAw5gDAHTyxjJ4obMxX4CcZPnL6Km1C1GijvsAEwBY6xV2/++o4WUUIBFtUihTOwuroURiCwzlTovDTjfcnQYY2AyEkAFRJH+bJAKSTp87O1YYbAXUWGngsC5LAv4GJ960Mh3dm0p9W2W2beYKcXZKMRYUb0hun2uNMdOqxtX7qmddlWkNTwJ7EchyUwtw0l1hw25vmWf9W3IqMeIo6GzUjWDTz6ZQy6JSzyWRTFpT2vve/JoZsf3Dt+aAOUszZKmR6ODGDhifRVGwd3fe1kczyHK9DeCNB80VPQQsuhhxqKfZP2pJkgpxzZPHoKh29zzwl63NS1UFqBWAM3PvloT5fDOL5836YpQyLHOU+SGL8FAAiqsa3lTUFd+1FMekWWdq8gzXxFonVYh0hLFhdP8II40T54X4I1DDlLkGTQ6CS6AdsyX4wFz95a/LtbSkpDjJLc34grJESUvIcMeamAYoEIf3L7EksOdjdVN6C9zWJ2tusmooO/vJzKGaobLPNOdQ4wxUV+pkZl/nlUx6pkOdxJQwyD0cdrhACiRK1xjdfB0iDJwBcS5DrrcWagu9KG79ccZOAQCCqtIAySHSg6MKHZgjNnSbHNlOB40PJ4QgSEgbmAL/inHy291JfZpVvm7ZyZZPiCVvYtjDjtIpdUUDfkYrcucj/lWJ2PA3AjGIKBSkEQIHgW/yeVJhjrMGLcZKUChgYctxgQa411Hy0RnYXeBAAsiz0QFIT/wJZQYbhIYY2Co3ZZ7efTzTw0kfBP1MfSGGEOeZY3egY4vn7EltEn1R65spSRoDNAblACLibEg12iRK5uBvZFbDFQEdoV3FLy6vOX8vbvAflgJtE3RBelEWqVUTrkkTql4DtFweqVkkdS60OrWR/lvslxLHE5HntzmRc/kw/WyvW4sERBDT4QBK8ZZIXeZFoJCk9pOpczGaHFmr6M4h9klGln22XdYaGS4ANlbriTQ8aUr+UkBzNVcUPs36fhNr/YSAqByUZZgT85X5gXMgxJgwNuAtsGJrIg4HbUMwOKcNHLckJ7jnh+BBoX8DJDLm+fJ8sADqkbYYtEbbKJOuSiCSTlHhhvQc9t0f5KJdTZZdlfklSGNgJs87TW+LgqiN4wuHOstuBapA9DCnFCdR746qqjGEJ6exrAtDFSKsTLM9YDTnnyq4w2SKGisXK67i9nsrHdJVFx19oVgDURme9KzQvKqnXFH2UegOae8EERiO8TaKGTYUCPqBq1qlO1EkSw8wVaBv2bWloCTusX4GPgD9x5EcFpdBk8aQgrCruIvCbUfhEyk1mUkU2pgWGPoogG+7XPkedDFuM0gRAjwTcTCxFQ/SCKUhGRbbmpZbkSCdb3awfc/ZIziSESFbY6OwFwwtZWZxGLNSPAa8Z08BtfTvtJw/2wNbsCpZimxr9c9CIxBsh9sUwOoxZhBV4DeoJJgp5IkoGF3OOGghkOCg0qcffYNBuTipmtemgSlRKiO7K4OrFJr7KhyKBQVDd0kFcMpEct5KYLpeAitSDCdkB8du8cOdk+29Q5b5NJVJxJDGCU9bnqxQIUTQvvz1HgWqPOD6Q/uE5i7yG16dCRSXLNvMyLXtrlko0asdYY/YAYL5Pnh/WagHkaskCiwTfMwIoqCgUDWc2V5UBBPdPtf6nsXqwjD2gFvz7rFWPgKxQAO2ImDrvhDlhdAOd+iOAxvIOCZAxymlyB3cy6sghhT6tMHGJ2gDJMoJxh+ZQiuxQ3iJ0ueNy7Q4fXi9ir33+V1DZHZesZTiaRFSRpjvvFOzPmeAK4l6zWPXfTZp3qPx9EyyZYQpIP/Mlieza0r43C4DKE6xRhLqyxfl5Kw9UaHJMKMf5h/j/G6VqILIrEN4mJUMiCMGZgNT3d+7SGvrBhFe9hEKEVaz5Jglg01328jdiNAZ4PREVrzUyGPUvlsr5PsE5Qx7I54EzJNMBbF7qgeaYtcWEMpRk8BYNTl9VyGZ3+oMfyKYhHRLbNv080G5Orq5lUKAkOMMTDRKeDqILJbKNSYKdRYEPlN18N1SNyONXIfesBBrAwLMBlEYQeFEiMitXWlhiBYINioiKllz0u59S+iIJgoLXId0DCIojAiNxnh86yr24Ao197d65IVSrKECGT0tR+Hmhltve9t86/diN12LXL7xVDGUyHMh4OYhHzpgTGYvBhPRp+v/PhkcvUOf0h4msdpe2mWNAMiTgv+DHh34AAAjc66Totc3LxUmt87fyik4KOOXFlPI86InFllGIuaKN8IaMTzpvq99hKzJZjRpwDoT4LpsKNMRFn6UqWdiATLrNvMS+/wtnS1fvn+ba3aLkR086yrW2dd2Jr3ooykFl42v/5Tkh25BgDgtnmSLHWt70i+yok4Of6QK0TnahA3Fk0lSSI0RS3xlrC/yOv2JgHrawDK578qJ9EqRl0q6c7zjISHUCncZM43idtedbwNf5ZuXRgY+iQN/nvSX9nxQah2sgsiut41L8SlKOxeSfh2g+NLVYWah6wp/GQNuPC37hsgEnQ0EGmGjG4JpuSnBeMadsRuwgTXBeyoTRoikCvObHEhsabAIScYqogk7htqJzjfINidmMwGU2qp7RHvimHGwB47ojT9jJPSdR+d6wF6F7zUjRJQ6Hlc9UsKtBfVP77kqX7NR/u6v+4VXy25MMuOIcKdqKoxvbb4nLfK9QiDG3EmZ+9ruJdEj/49bhip6/zWIxlheiVURzTC4FKApkyoGVbFTs5pAHYl1xTc8tHjMrr4t9aR1Yp716uJMOudPeWs6P0g5tPnjrGQFJGvUD789vBdokOhvHraGemUI7cSjojFnDfM1s5pzAFwZpLcTXI48cv3r8nV+XdCjHhtrm0xOr5B9/A2gxM7rW4Zx9170/aBYKOj4zRL9r7koXHLV/+Kl+aDV5XkqZYQhch/We6WG+6cFZpVWwrfeBREgd6YI8UFymGXOSrUgDfEvHSueWtd99WR8Tdp6RrOFHzZ3HjNXfOGt85lDw21SPvP376QIKbjcQo8968PMcbY8vShGkBIhv/ewxsooptjy2txETm/7Ow9JfJ1wShEOdVpnt40nG9Cefu3XsVE6x0OJ3WyXAnlOBGnA9UyXj5E5OgZLE5bZfjdDjXYbHr0Dw1+vVQ3suxa/OjmpUOFbIfcZMAomqsEnhateKDBxFwxSLLIAbBCxHbQKPAg4ttXKQkJmF5Bzm0MKIzdayd2vzSZZIGgPoYtSWMMTNLZYAqbp4w9BT/9U6b5Y9zojA8SmgeR9XdtzVCq/o3gepKyRMd2PySaFkMZUN8HvnZ+a+/62oEpE2Lm9hQqxfuHwg7YKR1fuiFbDMrZB8mQq/FaQBAhxM/feus/vSOlA2M/a2xt2qpxGBySOQAPXtlik+5HEmrjTtqoWSJPKj0SrcgVJErGAkOKAsRo78e2L59I3JXbWCyWriEdaoRc3QjoxSuC4U0q7scoRznJcZ62wFQZg/TyqYp3r4hWTLICvwqig9stTz96U8NudQGRorfP8c978yimMnudxv5F8jwvPjaOzOkY7jCAPQ9AfkyW5wCHQWRYN2kfaur6NIlOJ4qNj29Wq+xGwx0ynCgUA57cLVpGo9NRFZn0xqfbCYKcaEoBY1gd9sZSQgZJsXP0+n0E/IFQ6TswSQ9c8lkm1I4NEI5+chMRP+G+Lrih32N3wU1e8j9UeTxAjomNpAli+xLcyHojbDyTGkI4UqUeib+w+SSVy01lN3tC+R8RfCMvMxo1h9ggMdiaFNv2zo+eL8klG2KW8CSvvPFZWWONR2E0rfoR5Op2GnEO5DrdNlURTOlhKcMTzQNpCdDLkmEDh6OgceuwxiB8Ofh1oM+wyOFA0E6NjEud31qxARe8K9VOcWA3PpdUUzBU0THcAWyAxBhaEPn+OCkqNXKKUWuq7e3dFNsT95Urm9DIy9lgNZM8X9/SeER8081gvVtBBnOh2lORE/DTo55y2JThxpAFKeq5Wv8AosCOSDPdL0uesHxvqD8F0PdRJxnA8maL08+WYgX8FMVDrm8FgEI61Fw8yBCz4zHl9qGnDWWM8oRRlyW1uvghbvbDdhYT7CkzsjZteg3a8JNs8zWqmfzYXdyJbDPGACZPH55CK5pxjEMCIQ7/jdQta7IeCzji3QHbZTU4C67FbHBIRHfMu8M9R5ILgMHZN+hpJAEYZKC6yZhYlTeFRt2DE9HkoQhFdj9RUqsUdOeJ3k4hn8s8fidz36Tr552o73hCMJhxYTWp9vnB79qbSVU6Yz1Y5UTH+ZrDKSGj0pGQieyZ5p7Wt13N8LQN7SgonvnyIaPZ6RfNjZCmCljeLBkI93LOlmeikAPnbLtyhBUJIB9riD9rqV8KOUJSdOd8VCYywcnLX9Rj7AG2WqGy54q/1nLNPbNl2RFJ5k0aB/NflG9XPwr1dMMyAGWM1uXmIj5kuVLkuh7MgD5cP1HdD1Uh44YKzYbEMFagPEDqV4JJaFKdNLZzWj/RpR6OP+LI4DjsmqRuFINDBT1YhgVuSMRitV9Dt8C2JiQ2V8Uy8LHlwbYsJIgxPFHjDeCw3duw/LSR/drQJ+3t+9JLqDiFV1RNdnVLHaarifseDqDhc+wp+oaKsLGiLtKNsPnEWLGP8LDYqIZioMQpGhrbwCgBfL8oCTmzbta17RTibAA3Q7bBLIjli7HNFmVALvy9SIL7fknSOLJ5Al08qo8JxnsiYQpsPqKYr4ixIhQ/C3tc+96He9SU7PhQ8jvBlYK+RO5lEVg9IHkJHY64TMSWNCoJjvPU+THGGAthI5M0QoQaIPC/r0XpVhDSHvc53TbN9Il5kosoMQOrQZaodLS5WIgBAtCE2A7tJGeSEUzWPocAtrwshTrpldp7XrW+nci7IBkPZhneaKW1OBOD0Zn3XR8BgEI7dNyCoFLE3TCryx5qJAbAfo9qDHMR77Lh7Fps1qDw47C3/Crjw3+ZH3V4EEoyvYbL3/CDUyz+GlGUTLhI7cfXzDYXtlie2mZ/9kSASm3L61HXH+7aOTLPfjglYOLA7ag7jv2TW3F4SeMToktKIBqdNLd1tv+sNBWBnADIKj8eeNe/IolkcP/wLtjIC19XejyMGmn3T3YWuepBoYXez375sXvsxBfI8aNIGhy3mJDbLOtUDtzxM6r98PrHumLibjpDjKGEMgb6yIS2NS53eG2vwB+ae5tuJx/JrI8hYL7fwYQeirgPYO2c+8l2hCTJa9UEp7nK/OOFqibeHwO7blhN2sUwDfE4UwhUwX9L3j5db3joxcc3Z9zvQogAAnZ+pXEB5UmIAjPU7oBffifc+PNQ/TcmbDAI735FMiL+t0dR1AhrB4dWjfVj4opAOJAhJxtmjkgwAAqOdSRYrCyMRiFubDtoLw5AxwbFPeB7DPeVIjxec2/7cotDY7Nr5aItIGm5qactuCwFYpSo4mp9rZ7hCvBaNwEprm99p5/lZVrg3/qlCxKeAwmUVPXhVXBFCjRcDKpMSXpeGPwINfwin2YrpNhlNzwiefxoiqQKr3txVNGb6l3uEnS2p7DC9/DqLPkku5QXxODji9Y3uhnuNgXB7b3dBXUVYVVoY9Ky988jn2aBPAuqSEl7WaKZ6ppWWwSzqpbmkkCo3YOpC6tMl0+0zaxDIZ2sV4/iavICKpN1szzaejuhameJOv8RL9nK5lcYd5W+fQoFBuFVmU+a62wfhHzp/+ZbHAv2PZpI/yRNN9czsjYnpjYfarP8yhPhjnCdhGdo0n5DR5N5cRDs+ANVxIQ6TeUl+sJhTzIAIfV6GPu1vw+8f8/iGHi02Jd58c/z/MoTYH0LXlcqpTlG1eSMEABkFbbv2lvynz+Kq8iOf5xb1vis62sPeYXTOJHcKZhV2FofBMbwFsX40CTZY7WycEt3e2//lwvxV0QijvfhvruVRDLYnAbTvfr9q9jKrLGVWF8HvqIaA4Nr4x3nqfBPkl07Xn/iIdFw71HEgfsyF2O1XhD8eqkwk4POEm/amtcq70ZkmOaq8tIo80DjDEoFaLcBBWjbWYxPQ2FUHUEzkPAlsHP+8VUkdMUcMhjwIyQpZBOEl6fxWlyBRABqCJpKc6BFFGj6NwuEWhfL8Va9eylsdg1idmR1UXhyxvAaYgz8EO7pCK11lVhP+N2Nr8nDZPxWq1NKSfZCDrcuBWg197T9bXhUyE2c0+OmT1mCVb7f32YiaB+uLN+NegeA/tabiiwy2mWU6W2TF8Rgec4gw2ONyZHk5w+Imww2vVips6e6+RWmmmjucqc8K7TIDVxssO9apNECgz33Hsa87/i4Unf/Hi8pNseroY8z1ZMcmG3PoZHHVDdGk1NQTf6nIjeT5XkhT8m5xkL7AuWFvSRmafI8/dhgkxu43eKsYab3KgORvPpKrXRnRJv9QpjuPBXe68G6+Y2Vi80O8HjeTnhJHAyUcy3X3ctoe96hKJTQLhG/Vu+AZ1FUSE3mfPM9d1Kt/7I6xO18GdhgngYPq90lIS+J2Zqczz42JEONdYLJqUittfb/vGp7d8BLZpHWTvO8gITa/AU6AiAvHjY+maPECX/a63ETypJvx5kElCVuNjmmleJKa37asTCcGHobJNmNA7jxNOHk4MfUG16JhCiyeKLOd0N70zI14bAytIDJqyJwjvH2sJoU15zwOfIcy9UF9jmLLdPcA4m0kaXpoMcK6ypNM71PhyocjxE9FX3JssQeUzjKcQ7zVQXeY873wMA09scg9Ad59+h9zdvOZsCm0Grpvm/bTf6xTPcpaXwK7ZVmy7MBS1DKc6ANBKDoR4FnlhQDeCBQtbPfTcI4xT3uSQ7klsFqfR8CHEkMA7GtqvcvvEpiznurodGf23SzJJkghwpNMSTUA1FKsaN5QaLbE58Uqkc78plfHRwZ2cEmqwUYY8j5Rh8PNyy+8l+VXbivhSizy0daOhQEL9ITdigOF4014XQR1U+7t834H+ifS4ySZnmz2KM5Ix4lUUwOF7v6etcaHnIm5CkyWZ876CfnXhm3w/a8fJwtNv7Kd7XL1XY+aXqJ2XJ/6u4KLE9ktDznSsgXVEp2EHC7ZZHlzWh1miQdlOPt97iKwweLLH+wD9u/da8wFIEqc3imBdrC/mUo3LzCWCT8SZaA9+29QXKeZfFbbc7qpLsbZHix21yCv5rn+DFZo60A2C3PQx0IZkBjXinYA1ppbutNDm8yPva2s4Xd/gpIilM+StKxaFaSdqY7972b0KRnuZlI2suHcMpKA6j3yn/yoU4j2VklwZ5Gk//Zx9eOD8M4ndBUy4zaojXqeyGr70nLq79MDr/tatnpIXE1WAuNaAXepbe/4F+VsstH6rCf0riylgiODRCBLNwMNJwn2k4iwYrMbugITZO9+AhZoag+f5K21HAfVCJAD5es2pKUqoJ5Ehx+RXH3ssMpJdiWq+5eobKb1/aabqbzg/dlHz43v+1+j2VjKMfYzVfiwxhjGnvwkUMcKc8LjwbKZzeg4clHb54t0hRMe1GU8DgPcmAoZdggnk0pi3bWoFTgXKd7cIfJCeivQQEhZ7TPnwib2dljjtJHPRUU46ytsv3lYq0ueKkespPkNb86V4Uf0+2wkAAAFbFJREFUCkT/kOPeYXxqoRI/eNhUaGYroUoOSoIkWCApyL8owaswZrXqXkg3GNvPnKAxOlaYHyb3MbBJhCRctxLUeINWnKwWZ4KrUmm0eD1KYkCTpDx7AMV089UEwSrIqS8vf19rnek3X467urn+ZLDaFuuTHV+7V6rvDi9HBdIuFzEI+Se8LLIqDK4mZMij2RPvIXuCP7wqvaalAUC5DUaHPn3p4na8IRpm8G2gf5+71Gl/1YjKjIWa/OXNtSnPi543v9ZL91hldKCu/d0BP3kOu6uQHrJUZ1/S8weADSwx3BeDViMMLjc7FP40+5i/ErvjlfhnheDRve1okYm22GmP1mGaZngxmJ6BZ2MwPakQYw29ETBbufj1Y+V4W0iGD6lKh4SOosbHjDDHD+MM0tyhb130s1wOF1E+11uNHU1LdHYVNlZ96/u2SmtPVHUOh9U58Ujj0JrMWXp81R8bQFuu097f3N2W8/LhbCXWtPqHplk+NKr8bzo/cLuLqiU7oN0Pos1W6x8Mr860yb8P2myimOlEFI4f1TIcN6V+u6Rk+EOhSkxe1wiM4b1Gbb9UmKlVmm9Jw5O5UpybDY7lNxB7M3/v68PU1vOW1/n15aSsdTINhhrbSjG2f6gKYD7GAJmFPyqJEDeRpwFZIbt9xT3Kow2z3TGDLLQqAyr3i+sexzzKpLjNMEuaGRr7UShyAW/kvSz79v17z7cv2c9L97hJQlwcbXj85TMkNl4MUAMYYZ/VdeTEn+65YW/am/+U5ZMPt4BAKYAnzV2tglD9LM4AOSNQZwcfIC8jqCgxtCQF0mmKicn9A2Mn68PntuXGB31KhwuVMIZxKgxfZXJoldHBjcbHI59kw9eiwfpMdhdZ7C6D14F2cwo3X6G9f6WBiPvDmHedzVvMT6zROyjsJLbX7U7n9x5WxytxhNIZcHO5rK+y2Vw+4CkL1hFm/NU01200OrLG7PA6i+OCjreKG6oIJQcV9Fbn1pgdYXO+DrUTMBLRSMPlxvtXG4qElqeBSF5tcmiT9cmdbpInPRUh05bO7kLmq0fgFYIuSq5F7SJ6hwuRNTlP39exm19it728110KZlIj1QUKUdAwa0m4sBuqc3RT3GercBlmehLV19vnnPZXV1gcXGF6UDbWCjhNwPEWlHOha59ify3GUMRXgd/tFiAZdBZnSt48Be0NAGPmq1KDLM8dVmeuhetvsjzxuOll+bvny7X3cFhdfNPRctBXdoHZ7gO+Mqz2l950NIt4y+gko+BK3ae3u13Fmewu8DrdePi2BiMyDL4jbFeA4Wz9faTdC4jhnYEBstRX3CBucNp76KGkeC3WYKHZ3q5vPV1fek57qux0Ei8llF4++9CA2ZDfCJ43XBs+YA3FifvND/SDU4f2iBlAD4yw97tKrdcRwbxi3BisDJl8AwCgA3DmEl7l6eW6b7I/7lQY/J3QE9erJG6uNl9G/cNHr2tWqe2G9jOoFSTBWtNU5/4gcr3Ogc7ebvDbYDHOeSqf81SBh/EtQWk3siJ9i44I3KTu49sL7ih6q5fgym5w1jbVj04PkqshhZMTubxp/d29hS8r3Qoi5yvxg9v9uv39848N5MFLErYN9RjLDPdjjEHWcITYivx1R9Pnr70kOAXqYD996cSyCQmVYm1YthIW7IeGLjCD3V97YQGhUJNUyAa+OPijXwnwHwbDwPKDXwQuNZbTQbogrEdjR3P/UP8lQnHSJ4gfY78B9xcUBVwWS+fu+tYLSwUnwq0xnu8mfINdB1Dyr4SpBiMWa94D8e/ub+iJYC++6/qEPhcZcASJWC0E0YhdGdXtb2tUEh1CKtNoTU+KRZgQBtCDTVH39y99aA9PNO0PJBeMh9DqePBTbztYXIMoYfU1d7fDPEClKcFGxZMgt0E0zPz5W3//L25oRIyi4kgR2EnCQUTcLPFZASK/XSrRkrzd1nRfmBcU9CgZiFYhympcB2MkXDsmPIcfmnhoOKmUaHva+65UrKlmpjPWZyXkWdYCfWHbnKCW9tZ/7GUh6w6SxirePoOMI8NkdyjR0k9yBz0F0dCQhymNbU02Gf5d3z6XvqnOffnodev7R2+eehfHNnx6txB61YjRzbr29yxxxllQdHp1yxVvDfgBSPSVKnuffqhr7enc7y11NEAGq4Mj5w1MYywz2O/9MG6koYUf7vKCH5HiStT+OKLFNWIngKFZI7ckcePnDpNPNG6AbD8q0gVxZHck/0yeLkF6CjLzlZDRhB8c1cFyrH07nC6Bw+HIEklIWXS1HxtBZe26J6mcYI+1/RsBHxFqPom48XiwLKQntva2vO2sq24pK3qXnfoqKvypj0+lk1uptXOJhWW+oUGutl6utma2pkqmulK6hlKmjkK2gVKumXqujU4ubIvlaV8cDCWfEdWZ6SBAm55BbR0ISgA2vhAKdCfo0Y8falyLI6Zg4kb0zlJItUc06Fk8riplOqlnuqqmOKmnOavBke6ijh6u6HsaHK7qqa7qKS7qyU7qSU5qCY5qCU5q8CHFGb486KsA6fF8ttdaezrHqgts7pEftpvGVhT8b72ce1dj9d1LI6ADGqaAChqrocn+YS85qBZKepwPyRqFrx9/aP+YWJkrdt9oh9EJmIXKN7XxFTk8llfkQszANDdOcv/Q+Ukj0rb6wyv9ZHdwfxl1TiLnN2zROgIuCpvZ+YynxfkvK2h1jws43AbhCiF9jRQnnfR7uzzEoqqzRoRBMKkPppTefu+SOHKEZDiggxHoyHD4qJRM8igv2a5rg2OuM046J26Muh31JfmJw2cQ48k43PD3o3cSIv0YNzj6A4bEj9rthXw0uPF3tMGh/jDhGPXXr/29LT1vn358mFYf5l9lZVOgpJVxXSrx6KVI/mPBLIeCGPf57RD23MLnvoHz3loml792OK3a4rhqo8OqtXarVtuvWWW/YaXd5uU2tNDa+Q8LhrlmzNTGLBTGbLOM2BF9dkSXA9FkR9Q5KLR4/zTcs9HiOIv9pd0ekufuayjEW1vnBIRWphW9rgKdDNuSjBt4IWXoYE8I6T9bHc5S6wvSGApTGwnTGO+kMRKiMRSiNhCi0Rei1hOi1hGk1kYPGi1BGg0BauxQF6BS5adW4adS5l2ue0A93hnT5BOpqSnuj4EON7o2278qUT3Jkc3xfPzzXCxcALbE+Qhd6BxuluJd8wkN4thnBEL/fQj5bdc7DsbMMQdZ5NpmRHSjerwD2Ogs+mdFg/Su+mqArUWrfLi4rupjZ1v644Leb1+g/Mg81Uc21GLhXSHbjCC4lGG+j362p0igLBiX+YQE+FGkQ8yV0t3nUxI/3fjRv79TN3Hw+JnZJGzUik6EDuFQo7+vH61QHWaG7wPfmrpfP3yfEVbjYF0so5px8kYM9/kIxtMR24/c37g/YM1+/3V7/Tbs9tmw1+/vI0GMZ0L4rkbul0o8p5l5x6pAz/ORY+gT/6SXcXlvch5+KHn4/mF+Q2H6y+zE5xkRNSlBj+NhX1Lr4kDYCksh0Vo0XO8fH8U9bhKcDpehldYsdR4EumSosCGKTIgCI6LEgtxlQ5TY/lDjh66TAi43LgZpaCY4+z1MKG6setv+AcsLHmUIAZOAGfy++xMY0oSjDTuaultBRr/v+tSE7vjT2gRHN+Gv3YTPcHSi32NJmbhJc3lGdgkZ02lzVGvAx82vJBJMJZKMNZIdZBLMMaP2Ox4XWpXJ73Bjg8ER7XiXf+4pQLsDGkXeFRp7jNI8maDhnwIHOA+7HcQg93uOGCQL0Ak43DBN954jx7nkLr9+vGvUI2impkohz7ZITQgSxZs7WsHCFg83gLCdcZavWWFgwZuqsVnTxMj357aVugd8CBrjBzszjKWkn9kzEjdVpvkR4f5u/sW4gmQmQfyr6XNdwdsYr0ptnZxzN+O5zofvOBWy6fj9tcdC15+M2HwyfOvFCFbx2N1KaadMCqW8KyyTX4RVNBU2dNS29bb0QVObwYGub92NnW8rPz5Nbsj2rLivl28vlqxzMlJOOOgWo8+lv91OLrcTmWu6c5YOD6DkUKUIdb9oUQfkj8JnefjMiB7yTOhnOTiY0EOW8KUMPSK9A5GkRcS2IpI7IEo2S4F9pfZeLpvLl/w1LDP9Ml88BIxkprZsHZg0I/PHGoPctMbG1Nj9wSTLG/AKz7JozWyXzPpSkvWcWv3giJvcn3q7EVV2Cg3epbp7IXdwmcaeudDECe3vhJY4Aug0R4YLjVRIsa7RPbhQUwi5sxUR2wxgs1q0A/iCoOAinmQoJFtfjdXVznSJrc6rInRo7CfbBJHclAIJsUCNFzz+UUmE/xdv6TvNnexG/ZyQ+TVMPT19nc9aH0Q+s7AovADt2K5Ebz4dvvZE2LozEZsvRNFJJgqpp5+0LJC6X21b8j7tbdcrMKuG086/ttW2PU18GW1XYiaTKXky/iSnP+9a122LHDfMs9s413rTAjuGpU6ca+7t3uJ5jNnvkkCwBIQazoVpiUYZ3Ykyl4+1UU1y1Eh20Uxx1Up100px00xyUU9wUo6zl4uxFo8wFQ01PBegddhHaaeLBI+9KIv1RVqz03+bHF+hd2CuqgAiBzs37EDEtyBif0PqKiKxZa4KD7P1+dvhRmGP01+3vScliZISz8ZuLDpugfskLIGflik1ijeqP9Xp5rjBrl+CrqLQ+RyDw0iZQqDFAstSrgbpgYpgNznPaX5ht/PtQ+5S/3jJn/BROOGt8I+34v57kuwW53fo/bPfQVwqyiLlZTE8FWTGQwEtePmXwrScikK1012101yw5hHjPgk2L2DLWWcHVryr/bUs2hnbmfs3MyR+krRzcueht6+r6iOYvpramftux266FrX6etS6W7HbFFIE9HPPu5WrJb7wrWp+0NrbRMJ24ApNn1/nNsa7lhspZV2+GLNrd9B2voDNe4PY/gnbeznunEyGtF6BoWulR/TLhJy3D8qbq2H7onefmwHd7p8JQQ4DAFyu+XM7+BvgjhY2PIbaad/SBPNsf/kYm7P+mnzOtzaaHP9DQxj0D4Tz2K0uQQwemk5ggOEP62em9UJ+wlDGeOB+ZVpqbcnIwqgRW31CI/Sa93Vx1XnOxRHaGW4KibaKcbbqcY5acY4Wmb7wzM8+1Ld+7oA9NMBwkog0lowxOeQvI5NkBaFft9Io6NNI3Kd0UrueLD/vf79lPX4K7gJ+pnkHXZDBAWIPqMH+urbysBpDzSxhYIarMSsl4rfqZh5we3Qn8YVzZXN2S0/jAG54v9wv/Z+rWh5E1d4zLZaUTT98K2nXzaQ9iunnzQruBjx2yWtMBY3R1P3uy5AamWTLR2K6HgF+HcCRClQGRtSrjKhdGT4whGIq6CvAygDeQI88CJva5gZLRJmd89dQireFBh0NBB3yP2OMIeFEhAhx43WSxPanRP3151kPGitffWp88Qm2BfnysacN0iiaCFW2JW+fBFQmKqXZuJVGgP8k7H4btu26EK4OcStgCSw6M8VCh37ydPdxdcsklyHBRP+TFw73KyficAOkysDu761Zr/2M8o/cjtsoFv+3Qd5B7zKl3NdBjZ3VPd87yGmrb+D7686arIbwgGozx4q7tiXyXuVG6fWhz1rLPvY29eH6JtnFmBTLG0XWM6WrSYbQCI4aZjPcuGPr+fYVEpyhvPvXGWOEKYX/KchlYAi/nyjlCyyuc1Fq5nk+YrEG16O0JRKM9HLdzgepYBFlvUwnhRSbY2GKloVofxSXsqi6jqbX7R9ICVEDP9yYdEapGfe/4o0putK4CVVlQ0fF/aea2nlCOjm7vMplC9+Evu968a3/y+gdynH9rV9bnnc8LmlOL36fXPkh903Xi96+nrGyn0Du/UMHlu+E+y9MAo5sP8GBgeGt+qZYvfzbNcYUtz+u/FB7JEReNctBMtZEK9XpmK8MdHoMqIiNrMmEDY3uV6VcDtfyfZxY1lKLhXWxbV9QafELy4CfOtw6fXx0Zkfyi+wKKFNte3HEc2OvCtn4Whtgj+8DX0bYNujG4YTpHHro7u+dPX3doy17IhuQTBrcTOIH5HbmbzN3cSNDUqNX4acUGvI7kHuSdfWirRHMpPjq3JqW+qy6R88/vq5ueZVVXwqpGbAM4Fr8YP+HKZDdr0v6CRfsX9EhPzF+IPrvuK+1nQ/BvW798obcNh/eA3UQN5GGIVWHj/uzseHdf08r/pdeyOBvdkxH6rih7IOhVAhiStlPXPbfAmTxg4Pjl6xMAWMdytqY+UGBKiBLDEHxKNyUgpu4XyFH/MwSPe4HgMTUUQr8/4wxRmY5TN+XGhiFKJMZjf8vSx3871QmmHIY9cy4/8Z84qews/1/0pP7NY0x/oPNHC4x+Tf4KQoj3H8jDv3DG030AxzuPyEARjkdv3PefsIH+el1nNAh+XdMqZ+376cjimZM/uBn+kHwMzKoKdmNv3VmxlqEP2fK4qc4MNwv8T5+JqgAmSLn/aKI/S0Selohi5kdwA8DIzMq2vFTUYk/ZzVMOF3/Ofz6/1R3NTwOwiC0//8/v71LbotTWxAoWJcsl2w5lVLk80FN9CBt31vIR1xRAkMGIwFhRovSfom6lG5CSm2JZkJl7dK1wLK3t3mpXIW/4JxXxjKOU4BLBZyN7ZBpTuXNTNszEwGzNOzB09K1uza036gHG4mEScpZrYdMNHBNdlIasF2aNMQ0zUCekNgmETq4I6snqAfKWMiVruWY47wkmCMF7y1Z0Ga4jFLFg6Hg8Enhog2j4s0vMzkggB0//yfGfn+x0YazIH0O8PYmP5miBY5S0caiuW+Ui6rwvkpvsT/9ucbuNWd5ev2QvJ7+cATinANtEgtE6nf06iyURFz77T6NvAj7eyyMMXat0F5hxeLog+J3QZFemK8QKUXFbypTkPvJCV1ygS/a20g2gyZocOSuhShw5+TW1LTgO5bz4I15KpYmvIVzzZWsFycrfdEN4vfDgZQHFa3pRegealKfPPhoyYLkdUBaeUkBA6ZaegsX9h4lcnwVpkvJWamjxY9/o2BbTmwfXvV+iGFR7VFgIWanF27APJvubBOvx+sCPjADy+ya9zpISJLP8PzS7P6Xs9CHXu8IRD1VPn0EGNWB8VrBfMFr2Wz/2WYzx/c2LWCmFzRwbWKm3BPuw1VeVIv6aToe9VoPpptAgYeGnn7C17zv33KwipKanN4hpCAyPI3dXNT+asMCXSgI3mi0IwFPntuZy1vxGADtOFA/oZbu+GH5D6Pqex2UeeJxPwAIqJA/KC7DJf6gSNxR8EZRsBjDIar2HokKNYDO2AUKjuFr06zHo+IiQFlesvWAR+PEEJwZUOvtklaRnIEOCL8/93K7OL6HwSX20/4QB1hqc4FTBeDVDXBKITtlGAIKXQ8lClzrASEBEgdlkzA+VNt4R84zsy8WY7FH6UcEx7un/wDV9FjdMNxIUAAAAABJRU5ErkJggg==";
export const brandColor = '#0F7A3D';
export const brandSoftBg = '#F1F8F2';
export const brandBorder = '#DCEEE0';
export const brandTextColor = '#14231A';
export const brandMutedTextColor = '#5A6B60';
export const prefillDraftDocWidget = ['date', 'textbox', 'checkbox', 'radio button', 'image'];
export const prefillDraftTemWidget = [
  'date',
  'textbox',
  'checkbox',
  'radio button',
  'image',
  'dropdown',
];
export const MAX_NAME_LENGTH = 250;
export const MAX_NOTE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 500;
export const color = [
  '#93a3db',
  '#e6c3db',
  '#c0e3bc',
  '#bce3db',
  '#b8ccdb',
  '#ceb8db',
  '#ffccff',
  '#99ffcc',
  '#cc99ff',
  '#ffcc99',
  '#66ccff',
  '#ffffcc',
];

export const prefillBlockColor = 'transparent';
export function replaceMailVaribles(subject, body, variables) {
  let replacedSubject = subject;
  let replacedBody = body;

  for (const variable in variables) {
    const regex = new RegExp(`{{${variable}}}`, 'g');
    if (subject) {
      replacedSubject = replacedSubject.replace(regex, variables[variable]);
    }
    if (body) {
      replacedBody = replacedBody.replace(regex, variables[variable]);
    }
  }
  const result = { subject: replacedSubject, body: replacedBody };
  return result;
}

export const saveFileUsage = async (size, fileUrl, userId) => {
  //checking server url and save file's size
  try {
    if (userId) {
      const userPtr = { __type: 'Pointer', className: '_User', objectId: userId };
      const tenantQuery = new Parse.Query('partners_Tenant');
      tenantQuery.equalTo('UserId', userPtr);
      const tenant = await tenantQuery.first({ useMasterKey: true });
      if (tenant) {
        const tenantPtr = { __type: 'Pointer', className: 'partners_Tenant', objectId: tenant.id };
        try {
          const tenantCredits = new Parse.Query('partners_TenantCredits');
          tenantCredits.equalTo('PartnersTenant', tenantPtr);
          const res = await tenantCredits.first({ useMasterKey: true });
          if (res) {
            const response = JSON.parse(JSON.stringify(res));
            const usedStorage = response?.usedStorage ? response.usedStorage + size : size;
            const updateCredit = new Parse.Object('partners_TenantCredits');
            updateCredit.id = res.id;
            updateCredit.set('usedStorage', usedStorage);
            await updateCredit.save(null, { useMasterKey: true });
          } else {
            const newCredit = new Parse.Object('partners_TenantCredits');
            newCredit.set('usedStorage', size);
            newCredit.set('PartnersTenant', tenantPtr);
            await newCredit.save(null, { useMasterKey: true });
          }
        } catch (err) {
          console.log('err in save usage', err);
        }
        saveDataFile(size, fileUrl, tenantPtr, userPtr);
      }
    }
  } catch (err) {
    console.log('err in fetch tenant Id', err);
  }
};

//function for save fileUrl and file size in particular client db class partners_DataFiles
const saveDataFile = async (size, fileUrl, tenantPtr, UserId) => {
  try {
    const newDataFiles = new Parse.Object('partners_DataFiles');
    newDataFiles.set('FileUrl', fileUrl);
    newDataFiles.set('FileSize', size);
    newDataFiles.set('TenantPtr', tenantPtr);
    newDataFiles.set('UserId', UserId);
    await newDataFiles.save(null, { useMasterKey: true });
  } catch (err) {
    console.log('error in save usage ', err);
  }
};

export const updateMailCount = async extUserId => {
  // Update count in contracts_Users class
  const query = new Parse.Query('contracts_Users');
  query.equalTo('objectId', extUserId);

  try {
    const contractUser = await query.first({ useMasterKey: true });
    if (contractUser) {
      const _extRes = JSON.parse(JSON.stringify(contractUser));
      contractUser.increment('EmailCount', 1);
      await contractUser.save(null, { useMasterKey: true });
    }
  } catch (error) {
    console.log('Error updating EmailCount in contracts_Users: ' + error.message);
  }
};

export function sanitizeFileName(fileName) {
  // Remove spaces and invalid characters
  const file = fileName.replace(/[^a-zA-Z0-9._-]/g, '');
  const removedot = file.replace(/\.(?=.*\.)/g, '');
  return removedot.replace(/[^a-zA-Z0-9._-]/g, '');
}

export const useLocal = process.env.USE_LOCAL ? process.env.USE_LOCAL.toLowerCase() : 'false';
export const smtpsecure = process.env.SMTP_PORT && process.env.SMTP_PORT !== '465' ? false : true;
export const smtpenable =
  process.env.SMTP_ENABLE && process.env.SMTP_ENABLE.toLowerCase() === 'true' ? true : false;
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `generateId` is used to unique Id for fileAdapter
export function generateId(length) {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * FlattenPdf renders field values as static content and removes the interactive
 * form layer. Signatures are stripped entirely. Non-widget annotations (links,
 * comments, stamps) are preserved.
 * @param {string | Uint8Array | ArrayBuffer} pdfFile - pdf file.
 * @returns {Promise<Uint8Array>} flatPdf - pdf file in Uint8Array
 */
export const flattenPdf = async pdfFile => {
  const pdfDoc = await PDFDocument.load(pdfFile, { ignoreEncryption: true });

  try {
    const acroFormEntry = pdfDoc.catalog.get(PDFName.of('AcroForm'));
    const acroForm = pdfDoc.context.lookupMaybe
      ? pdfDoc.context.lookupMaybe(acroFormEntry)
      : pdfDoc.context.lookup(acroFormEntry);

    if (acroForm && typeof acroForm.set === 'function') {
      // Avoid pdf-lib form APIs here; some malformed PDFs crash while
      // iterating/removing fields. Clearing /Fields directly is safer.
      acroForm.set(PDFName.of('Fields'), pdfDoc.context.obj([]));
      acroForm.delete(PDFName.of('XFA'));
      acroForm.delete(PDFName.of('SigFlags'));
    }
  } catch {
    // If AcroForm is malformed, continue with page annotation cleanup.
  }

  for (const page of pdfDoc.getPages()) {
    try {
      const annotationsRef = page.node.get(PDFName.of('Annots'));
      if (!annotationsRef) continue;

      const annotations = pdfDoc.context.lookup(annotationsRef);
      if (!annotations || !annotations.asArray) continue;

      const filtered = annotations.asArray().filter(annotRef => {
        try {
          const annot = pdfDoc.context.lookup(annotRef);
          const subtype = annot?.get(PDFName.of('Subtype'));
          return subtype?.toString() !== '/Widget';
        } catch {
          return true;
        }
      });

      if (filtered.length === 0) {
        page.node.delete(PDFName.of('Annots'));
      } else {
        page.node.set(PDFName.of('Annots'), pdfDoc.context.obj(filtered));
      }
    } catch {
      // best effort cleanup
    }
  }

  try {
    pdfDoc.catalog.delete(PDFName.of('AcroForm'));
  } catch {
    // best effort cleanup
  }

  return await pdfDoc.save({ useObjectStreams: false });
};

/* ---- flattenPdf private helpers ---- */

function _safeGetWidgetsServer(field) {
  try {
    return field.acroField?.getWidgets?.() || [];
  } catch {
    return [];
  }
}

function _getWidgetRectServer(widget, pdfDoc) {
  try {
    const r = widget.getRectangle?.();
    if (r && isFinite(r.x) && isFinite(r.y) && isFinite(r.width) && isFinite(r.height)) {
      return r;
    }
  } catch {
    /* fall through to manual extraction */
  }

  try {
    const rectArr = widget.dict?.lookup?.(PDFName.of('Rect'));
    if (!rectArr || typeof rectArr.size !== 'function' || rectArr.size() !== 4) return null;

    const x1 = _numberFromPdfObjectServer(rectArr.get(0));
    const y1 = _numberFromPdfObjectServer(rectArr.get(1));
    const x2 = _numberFromPdfObjectServer(rectArr.get(2));
    const y2 = _numberFromPdfObjectServer(rectArr.get(3));

    if ([x1, y1, x2, y2].some(v => !isFinite(v))) return null;

    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  } catch {
    return null;
  }
}

function _numberFromPdfObjectServer(obj) {
  if (!obj) return NaN;
  if (typeof obj.asNumber === 'function') return obj.asNumber();
  if (typeof obj.numberValue === 'function') return obj.numberValue();
  return Number(obj?.value ?? obj);
}

function _getWidgetPageServer(pdfDoc, pages, widget) {
  try {
    const pRef = widget.P?.();
    if (pRef) {
      for (const page of pages) {
        if (page.ref === pRef) return page;
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const pRef = widget.dict?.get?.(PDFName.of('P'));
    if (pRef) {
      for (const page of pages) {
        if (page.ref === pRef) return page;
      }
    }
  } catch {
    /* fall through */
  }

  // Fallback: search page annots
  try {
    for (const page of pages) {
      const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
      if (!annots) continue;

      for (let i = 0; i < annots.size(); i++) {
        const ref = annots.get(i);
        if (ref === widget.ref) return page;
      }
    }
  } catch {
    /* fall through */
  }

  return null;
}

function _drawWidgetBoxServer(page, rect) {
  try {
    page.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      borderWidth: 0.6,
      borderColor: rgb(0.65, 0.65, 0.65),
    });
  } catch {
    /* best effort */
  }
}

function _drawTextFieldServer(page, field, rect, font) {
  let text = '';
  try {
    text = field.getText?.() ?? '';
  } catch {
    text = '';
  }
  text = String(text ?? '');

  if (!text) return;

  let multiline = false;
  try {
    multiline = field.isMultiline?.() ?? false;
  } catch {
    /* ignore */
  }

  let comb = false;
  try {
    comb = field.isCombed?.() ?? false;
  } catch {
    /* ignore */
  }

  if (comb) {
    _drawCombTextServer(page, text, rect, font);
    return;
  }

  if (multiline || text.includes('\n')) {
    _drawMultilineTextServer(page, text, rect, font);
    return;
  }

  const fontSize = _fitSingleLineFontSizeServer(text, rect, font);
  const baselineY = rect.y + Math.max(2, (rect.height - fontSize) / 2);

  page.drawText(text, {
    x: rect.x + 2,
    y: baselineY,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
    maxWidth: Math.max(1, rect.width - 4),
  });
}

function _drawMultilineTextServer(page, text, rect, font) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const fontSize = Math.max(8, Math.min(11, rect.height / Math.max(lines.length + 0.5, 2)));
  const lineHeight = fontSize + 1.5;

  let y = rect.y + rect.height - fontSize - 2;

  for (const line of lines) {
    if (y < rect.y + 1) break;

    page.drawText(line, {
      x: rect.x + 2,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: Math.max(1, rect.width - 4),
      lineHeight,
    });

    y -= lineHeight;
  }
}

function _drawCombTextServer(page, text, rect, font) {
  const chars = String(text).split('');
  const count = Math.max(chars.length, 1);
  const cellWidth = rect.width / count;
  const fontSize = Math.max(8, Math.min(12, rect.height - 4));

  chars.forEach((ch, i) => {
    const textWidth = font.widthOfTextAtSize(ch, fontSize);
    const x = rect.x + i * cellWidth + (cellWidth - textWidth) / 2;
    const y = rect.y + Math.max(2, (rect.height - fontSize) / 2);

    page.drawText(ch, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    if (i < count - 1) {
      try {
        page.drawLine({
          start: { x: rect.x + (i + 1) * cellWidth, y: rect.y },
          end: { x: rect.x + (i + 1) * cellWidth, y: rect.y + rect.height },
          thickness: 0.4,
          color: rgb(0.75, 0.75, 0.75),
        });
      } catch {
        /* best effort */
      }
    }
  });
}

function _fitSingleLineFontSizeServer(text, rect, font) {
  let size = Math.min(12, rect.height - 4);
  size = Math.max(size, 6);

  while (size > 6) {
    const width = font.widthOfTextAtSize(text, size);
    if (width <= rect.width - 4) return size;
    size -= 0.5;
  }

  return 6;
}

function _drawCheckBoxServer(page, field, rect, zapf) {
  let checked = false;
  try {
    checked = field.isChecked();
  } catch {
    checked = false;
  }

  if (!checked) return;

  const size = Math.max(8, Math.min(rect.width, rect.height) - 4);

  page.drawText('\u2714', {
    x: rect.x + Math.max(1, (rect.width - size * 0.7) / 2),
    y: rect.y + Math.max(1, (rect.height - size) / 2),
    size,
    font: zapf,
    color: rgb(0, 0, 0),
  });
}

function _drawRadioGroupServer(page, field, widget, rect) {
  let selected = null;
  try {
    selected = field.getSelected();
  } catch {
    selected = null;
  }

  if (!selected) return;

  let widgetOnValue = null;
  try {
    widgetOnValue = widget.getOnValue?.();
  } catch {
    /* ignore */
  }

  if (!widgetOnValue) {
    try {
      const ap = widget.dict?.lookupMaybe?.(PDFName.of('AP'), PDFDict);
      const n = ap?.lookupMaybe?.(PDFName.of('N'), PDFDict);
      if (n) {
        const keys = n.keys();
        for (const k of keys) {
          const name = k?.decodeText?.() ?? k?.encodedName ?? String(k);
          if (name !== '/Off' && name !== 'Off') {
            widgetOnValue = name.replace(/^\//, '');
            break;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  const selectedStr = String(selected).replace(/^\//, '');
  const onStr = String(widgetOnValue ?? '').replace(/^\//, '');

  if (!onStr || selectedStr !== onStr) return;

  // Circle outline
  try {
    page.drawEllipse({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      xScale: rect.width / 2 - 1,
      yScale: rect.height / 2 - 1,
      borderWidth: 0.8,
      borderColor: rgb(0, 0, 0),
    });
  } catch {
    /* best effort */
  }

  // Inner filled dot
  try {
    const r = Math.min(rect.width, rect.height) / 4;
    page.drawEllipse({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      xScale: r,
      yScale: r,
      color: rgb(0, 0, 0),
    });
  } catch {
    /* best effort */
  }
}

function _drawDropdownServer(page, field, rect, font) {
  let text = '';
  try {
    const selected = field.getSelected?.();
    if (Array.isArray(selected)) {
      text = selected.join(', ');
    } else {
      text = selected ?? '';
    }
  } catch {
    text = '';
  }

  text = String(text ?? '');
  if (!text) return;

  const fontSize = _fitSingleLineFontSizeServer(text, rect, font);

  page.drawText(text, {
    x: rect.x + 2,
    y: rect.y + Math.max(2, (rect.height - fontSize) / 2),
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
    maxWidth: Math.max(1, rect.width - 12),
  });
}

function _drawOptionListServer(page, field, rect, font) {
  let selected = [];
  try {
    selected = field.getSelected?.() || [];
  } catch {
    selected = [];
  }

  if (!Array.isArray(selected)) {
    selected = [selected].filter(Boolean);
  }

  if (!selected.length) return;

  const lines = selected.map(v => String(v));
  const fontSize = Math.max(8, Math.min(11, rect.height / Math.max(lines.length + 0.5, 2)));
  const lineHeight = fontSize + 1.5;

  let y = rect.y + rect.height - fontSize - 2;

  for (const line of lines) {
    if (y < rect.y + 1) break;

    page.drawText(line, {
      x: rect.x + 2,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: Math.max(1, rect.width - 4),
    });

    y -= lineHeight;
  }
}

/** Remove only Widget annotations; preserve links, stamps, comments, etc. */
function _removeWidgetAnnotationsServer(pdfDoc) {
  for (const page of pdfDoc.getPages()) {
    try {
      const annotationsRef = page.node.get(PDFName.of('Annots'));
      if (!annotationsRef) continue;

      const annotations = pdfDoc.context.lookup(annotationsRef);
      if (!annotations || !annotations.asArray) continue;

      const filtered = annotations.asArray().filter(annotRef => {
        try {
          const annot = pdfDoc.context.lookup(annotRef);
          const subtype = annot?.get(PDFName.of('Subtype'));
          return subtype?.toString() !== '/Widget';
        } catch {
          return true;
        }
      });

      if (filtered.length === 0) {
        page.node.delete(PDFName.of('Annots'));
      } else {
        page.node.set(PDFName.of('Annots'), pdfDoc.context.obj(filtered));
      }
    } catch {
      /* best effort */
    }
  }

  try {
    pdfDoc.catalog.delete(PDFName.of('AcroForm'));
  } catch {
    /* best effort */
  }
}

// Format date and time for the selected timezone
export const formatTimeInTimezone = (date, timezone) => {
  const nyDate = timezone && toZonedTime(date, timezone);
  const generatedDate = timezone
    ? format(nyDate, 'EEE, dd MMM yyyy HH:mm:ss zzz', { timeZone: timezone })
    : new Date(date).toUTCString();
  return generatedDate;
};

// `getSecureUrl` is used to return local secure url if local files
export const getSecureUrl = url => {
  const fileUrl = new URL(url)?.pathname?.includes('/files/');
  if (fileUrl) {
    try {
      const file = getSignedLocalUrl(url);
      if (file) {
        return { url: file };
      } else {
        return { url: '' };
      }
    } catch (err) {
      console.log('err while fileupload ', err);
      return { url: '' };
    }
  } else {
    return { url: url };
  }
};

export const mailTemplate = param => {
  const subject = `${param.senderName} has requested you to sign "${param.title}"`;
  const AppName = appName;
  const logo = `<div style='padding:20px 24px;border-bottom:3px solid ${brandColor};'><img src='${brandLogoUrl}' alt='${AppName}' height='44' style='display:block;border:0;' /></div>`;

  const detailRow = (label, value) =>
    value
      ? `<tr><td style='padding:6px 16px 6px 0;font-weight:bold;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${brandTextColor};white-space:nowrap;'>${label}</td><td style='padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${brandMutedTextColor};'>${value}</td></tr>`
      : '';

  const body =
    `<html><head><meta http-equiv='Content-Type' content='text/html;charset=UTF-8' /></head><body><div style='background-color:${brandSoftBg};padding:24px 12px;font-family:Arial, Helvetica, sans-serif;'><div style='max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${brandBorder};'>` +
    logo +
    `<div style='background-color:${brandColor};padding:14px 24px;'><p style='margin:0;font-size:18px;font-weight:600;color:#ffffff;'>Digital Signature Request</p></div><div style='padding:28px 24px;'><p style='margin:0 0 20px 0;font-size:14px;color:${brandTextColor};line-height:1.6;'>` +
    param.senderName +
    ' has requested you to review and sign <strong>' +
    param.title +
    `</strong>.</p><table style='border-collapse:collapse;margin-bottom:24px;'>` +
    detailRow('Sender', param.senderMail) +
    detailRow('Organization', param.organization) +
    detailRow('Expires on', param.localExpireDate) +
    detailRow('Note', param.note) +
    `</table><div style='text-align:center;margin:0 0 8px 0;'><a target=_blank href=` +
    param.signingUrl +
    ` style='background-color:${brandColor};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 34px;border-radius:6px;display:inline-block;'>Sign here</a></div></div><div style='background-color:${brandSoftBg};padding:14px 24px;border-top:1px solid ${brandBorder};'><p style='margin:0 0 4px 0;font-size:11px;color:${brandMutedTextColor};'>This is an automated email from ` +
    AppName +
    '. For any queries regarding this email, please contact the sender ' +
    param.senderMail +
    ` directly.</p><p style='margin:0;font-size:11px;color:${brandMutedTextColor};'>Power Planning &amp; Monitoring Company &middot; Ministry of Energy &middot; Govt. of Pakistan</p></div></div></div></body></html>`;

  return { subject, body };
};

export const selectFormat = data => {
  switch (data) {
    case 'L':
      return 'MM/dd/yyyy';
    case 'MM/DD/YYYY':
      return 'MM/dd/yyyy';
    case 'DD-MM-YYYY':
      return 'dd-MM-yyyy';
    case 'DD/MM/YYYY':
      return 'dd/MM/yyyy';
    case 'LL':
      return 'MMMM dd, yyyy';
    case 'DD MMM, YYYY':
      return 'dd MMM, yyyy';
    case 'YYYY-MM-DD':
      return 'yyyy-MM-dd';
    case 'MM-DD-YYYY':
      return 'MM-dd-yyyy';
    case 'MM.DD.YYYY':
      return 'MM.dd.yyyy';
    case 'MMM DD, YYYY':
      return 'MMM dd, yyyy';
    case 'MMMM DD, YYYY':
      return 'MMMM dd, yyyy';
    case 'DD MMMM, YYYY':
      return 'dd MMMM, yyyy';
    case 'DD.MM.YYYY':
      return 'dd.MM.yyyy';
    case 'DD-MMM-YYYY':
      return 'dd-MMM-yyyy';
    default:
      return 'MM/dd/yyyy';
  }
};

export function formatDateTime(date, dateFormat, timeZone, is12Hour) {
  const zonedDate = toZonedTime(date, timeZone); // Convert date to the given timezone
  const timeFormat = is12Hour ? 'hh:mm:ss a' : 'HH:mm:ss';
  return dateFormat
    ? format(zonedDate, `${selectFormat(dateFormat)}, ${timeFormat} 'GMT' XXX`, { timeZone })
    : formatTimeInTimezone(date, timeZone);
}

export const randomId = (digit = 8) => {
  // 1. Grab a cryptographically-secure 32-bit random value
  // Use crypto for stronger randomness
  const randomBytes = crypto.getRandomValues(new Uint32Array(1));
  const raw = randomBytes[0]; // 0 … 4,294,967,295

  // Calculate the min and max for the given digit length
  const min = Math.pow(10, digit - 1); // e.g., digit=3 → 100
  const max = Math.pow(10, digit) - 1; // e.g., digit=3 → 999
  const range = max - min + 1;

  // Collapse random value into the range and shift
  return min + (raw % range);
};
export const handleValidImage = async Placeholder => {
  const updatedPlaceholders = [];

  for (const placeholder of Placeholder || []) {
    //Clean and format signerPtr
    let signerPtr = placeholder.signerPtr;
    // Check if signerPtr exists and has an id
    if (signerPtr?.id) {
      // Case 1: If signerPtr is a Parse Object instance
      if (signerPtr instanceof Parse.Object) {
        // If signerPtr has no attributes, it’s a plain pointer already
        if (!signerPtr.attributes || Object.keys(signerPtr.attributes).length === 0) {
          // Convert to a clean pointer using Parse’s built-in method
          signerPtr = signerPtr.toPointer();
        } else {
          // If it has attributes, manually construct the pointer object
          signerPtr = {
            __type: 'Pointer',
            className: signerPtr.className,
            objectId: signerPtr.id,
          };
        }
        // Case 2: If signerPtr is already a plain JS object resembling a pointer
      } else if (typeof signerPtr === 'object' && signerPtr.className && signerPtr.objectId) {
        // Normalize it to a valid Parse pointer object
        signerPtr = {
          __type: 'Pointer',
          className: signerPtr.className,
          objectId: signerPtr.objectId,
        };
      }
    }

    //Process placeHolder if Role is 'prefill'
    if (placeholder?.Role === 'prefill') {
      const updatedRole = [];
      for (const item of placeholder.placeHolder || []) {
        const updatedPos = [];
        for (const posItem of item.pos || []) {
          if (
            (posItem?.type === 'image' || posItem?.type === 'draw') &&
            posItem?.options?.response
          ) {
            const validUrl = await getPresignedUrl(posItem?.options?.response);
            updatedPos.push({
              ...posItem,
              ...(item.SignUrl !== undefined && { SignUrl: validUrl }),
              options: { ...posItem.options, response: validUrl },
            });
          } else {
            updatedPos.push(posItem);
          }
        }
        updatedRole.push({ ...item, pos: updatedPos });
      }

      updatedPlaceholders.push({ ...placeholder, signerPtr, placeHolder: updatedRole });
    } else {
      // Not prefill role, just push as-is
      updatedPlaceholders.push({ ...placeholder, signerPtr });
    }
  }
  return updatedPlaceholders;
};
