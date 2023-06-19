var db=require('../config/connection')
var collection = require('../config/collections')
var objectId = require('mongodb').ObjectId

module.exports={

    // inserting data into the database
    addProduct:(product,callback)=>{
        

        db.get().collection('product').insertOne(product).then((data)=>{
            
            callback(data.insertedId)
        })
        
    },
    // fetching data from the database
    getAllProducts:()=>{

        return new Promise(async (resolve,reject)=>{
        let products =await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray()
        resolve(products)
    })
    },

    deleteProduct:(productId)=>{

        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).deleteOne({_id:new objectId(productId)}).then((response)=>{
                resolve(response)
            })
        })
    },

    getProductDetails:(productId)=>{

        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).findOne({_id:new objectId(productId)}).then((product)=>{
                resolve(product)
            })
        })
    },

    updateProduct:(productId,productDetails)=>{

        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).updateOne({_id:new objectId(productId)},{
                $set:{
                    Title:productDetails.Title,
                    Category:productDetails.Category,
                    Description:productDetails.Description,
                    Price:productDetails.Price
                }
            }).then((response)=>{
                resolve(response)
            })
        })
        
    },

    
}