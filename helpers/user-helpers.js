var db = require('../config/connection')
var collection = require('../config/collections')
var bcrypt = require('bcrypt')
var objectId = require('mongodb').ObjectId
const Razorpay = require('razorpay')
const { ObjectId } = require('mongodb')
const { reject } = require('lodash')
var instance = new Razorpay({
    key_id: 'rzp_test_n4ZjaXAr7wzARl',
    key_secret: 'kJrqmufxfe9eLhpJtti7BEyN'
})

// password encryption and insertion of user login data in the database
module.exports = {

    doSignup: (userData) => {
        return new Promise(async (resolve, reject) => {
            userData.Password = await bcrypt.hash(userData.Password, 10)
            db.get().collection(collection.USER_COLLECTION).insertOne(userData).then((data) => {
                resolve(data)
            })
        })

    },

    doLogin: (userData) => {
        let response = {}
        return new Promise(async (resolve, reject) => {
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ Email: userData.Email })
            if (user) {
                bcrypt.compare(userData.Password, user.Password).then((status) => {
                    if (status) {
                        console.log("Login Succcess")
                        response.user = user
                        response.status = true
                        resolve(response)
                    } else {
                        console.log('login failed')
                        resolve({ status: false })
                    }
                })
            } else {
                console.log("Enter valid Address")
                resolve({ status: false })
            }
        })
    },

    addToCart: (productId, userId) => {
        let productObj = {
            item: new objectId(productId),
            quantity: 1
        }
        return new Promise(async (resolve, reject) => {
            let userCart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new objectId(userId) })
            if (userCart) {
                let productExist = userCart.products.findIndex(product => product.item == productId)
                if (productExist != -1) {
                    db.get().collection(collection.CART_COLLECTION)
                        .updateOne({ user: new objectId(userId), 'products.item': new objectId(productId) },
                            {
                                $inc: { 'products.$.quantity': 1 }
                            }).then(() => {
                                resolve()
                            })
                } else {
                    db.get().collection(collection.CART_COLLECTION).updateOne({ user: new objectId(userId) },
                        {

                            $push: { products: productObj }

                        }
                    ).then((response) => {
                        resolve()
                    })
                }
            } else {
                let cartObj = {
                    user: new objectId(userId),
                    products: [productObj]
                }
                db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response) => {
                    resolve()
                })
            }
        })
    },

    getCartProducts: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: new objectId(userId) }
                },

                {
                    $unwind: '$products'
                },

                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'

                    }

                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                }

            ]).toArray()

            resolve(cartItems)
        })

    },

    cartCount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let count = 0
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new objectId(userId) })
            if (cart) {
                count = cart.products.length
            }
            resolve(count)
        })
    },

    changeProductQuantity: (cartDetails) => {
        console.log(cartDetails.quantity)
        let count = parseInt(cartDetails.count)
        return new Promise((resolve, reject) => {
            if (count == -1 && cartDetails.quantity == 1) {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne({ _id: new objectId(cartDetails.cartId) },
                        {
                            $pull: { products: { item: new objectId(cartDetails.productId) } }
                        }).then((response) => {
                            resolve({ removeProduct: true })
                        })
            } else {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne({ _id: new objectId(cartDetails.cartId), 'products.item': new objectId(cartDetails.productId) },
                        {
                            $inc: { 'products.$.quantity': count }
                        }).then((response) => {
                            resolve({ status: true })
                        })
            }
        })
    },

    getTotalAmount: (userId) => {
        console.log("userid : ", userId);
        return new Promise(async (resolve, reject) => {
            let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: new objectId(userId) }
                },

                {
                    $unwind: '$products'
                },

                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'

                    }

                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                    $addFields: { 'product.Price': { $toDouble: '$product.Price' } }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $multiply: ['$quantity', '$product.Price'] } }
                    }
                }

            ]).toArray()
            if (total[0]) {
                resolve(total[0].total)
            } else {
                resolve(total)
            }
        })
    },

    getAllProductsList: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new objectId(userId) })
            resolve(cart.products)
        })
    },

    placeOrder: (orderDetails, products, totalPrice) => {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

        

        return new Promise((resolve, reject) => {
            let status = orderDetails['payment-method'] === "COD" ? 'placed' : 'pending'
            let orderObj = {
                deliveryDetails: {
                    mobile: orderDetails.mobile,
                    address: orderDetails.address,
                    postcode: orderDetails.postcode

                },
                userId: new objectId(orderDetails.userId),
                products: products,
                total: totalPrice,
                payment: orderDetails['payment-method'],
                status: status,
                date:new Date().toLocaleDateString('en-US', options)
            }

            db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response) => {
                db.get().collection(collection.CART_COLLECTION).deleteOne({ user: new objectId(orderDetails.userId) })
                resolve(response.insertedId)

            })
        })
    },

    getUserOrders: (userId) => {
        return new Promise(async (resolve, reject) => {
            let orders = await db.get().collection(collection.ORDER_COLLECTION)
                .find({ userId: new objectId(userId) }).toArray()
            resolve(orders)
        })
    },

    getOrderProducts: (orderId) => {
        return new Promise(async (resolve, reject) => {
            let orderItems = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { _id: new objectId(orderId) }
                },

                {
                    $unwind: '$products'
                },

                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'

                    }

                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                }

            ]).toArray()
            console.log(orderItems)
            resolve(orderItems)
        })

    },

    generateRazorpay: (orderId, total) => {

        return new Promise((resolve, reject) => {
            var options = {
                amount: total * 100,
                currency: "INR",
                receipt: '' + orderId,
            }
            instance.orders.create(options, function (err, order) {
                if (err) {
                    console.log(err)
                } else {
                    console.log('New order:', order)
                    resolve(order)
                }
            })
        })
    },

    verifyPayment: (paymentDetails) => {
        return new Promise((resolve, reject) => {
            const crypto = require("crypto");
            let hmac = crypto.createHmac('sha256', 'kJrqmufxfe9eLhpJtti7BEyN');
            hmac.update(paymentDetails['paymentDetails[razorpay_order_id]'] + '|' + paymentDetails['paymentDetails[razorpay_payment_id]'])
            hmac = hmac.digest('hex')
            if (hmac == paymentDetails['paymentDetails[razorpay_signature]']) {
                resolve()
            } else {
                reject()
            }
        })
    },

    changePaymentStatus: (orderId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION)
                .updateOne({ _id: new objectId(orderId) },
                    {
                        $set: {
                            status: 'placed'
                        }
                    }).then(() => {
                        resolve()
                    })
        })
    },

    removeCartProduct: (cartId, productId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.CART_COLLECTION).findOneAndUpdate(
                { _id: new objectId(cartId) },
                {
                    $pull: { products: { item: new objectId(productId) } }
                },
                { returnOriginal: false }
            ).then(() => {
                resolve()
            })
        })
    }

}


