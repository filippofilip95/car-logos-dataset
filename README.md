
# Car Logos 
This repository contains car manufacturers logos in `.jpg` or `.png` files.
Data were crawled on `31.8.2019` from website [Carlogos.org](https://www.carlogos.org/)

## Why
I needed these logos for own use in a software project. 
I decided to publish my crawled data because they may help you with building software, where you need to embed or use this kind of images.

## Content
The repository contains folder `images` with car logos images.
These data are described in JSON file `car-logos.json` 

### Data example 
```
{  
  "name": "Volkswagen",  
  "url": "https://www.carlogos.org/logo/Volkswagen-logo-2015-1920x1080.png",  
  "fileName": "Volkswagen.png"  
}
```
*url property is original address from where was image downloaded*

## Embedding
If you wish to embed image you can do it with URL from this repository.

### Usage
```
const fileName = 'Volkswagen.png'

const logoUrl = `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/images/${fileName}` 
```


## License
- [MIT](https://choosealicense.com/licenses/mit/)
- All images are the property of their respective owners. If you found any image copyrighted to yours, Please contact us, so we can remove it.

