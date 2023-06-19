var express = require('express');
var router = express.Router();
var productHelper = require('../helpers/product-helpers');
var userHelpers= require('../helpers/user-helpers');



const verifyLogin=(req,res,next)=>{
  if(req.session.loggedIn){
    next()
  }else{
    res.redirect('/login')
  }
}

/* GET home page. */
router.get('/',async function(req, res, next) {
  let user=req.session.user
  var cartCount=null
  if(req.session.user){
   cartCount=await userHelpers.cartCount(req.session.user._id)
  }
  productHelper.getAllProducts().then((products)=>{
    res.render('user/view-products', {title:'SMart-Shoppy',products,user,cartCount})})
  });

router.get('/login',(req,res)=>{
  if(req.session.loggedIn){
    res.redirect('/')
  }else{
  res.render('user/login',{loginErr:req.session.loginErr})
  req.session.loginErr=false
  }
})

router.get('/signup',(req,res)=>{
  res.render('user/signup')
})

router.post('/signup',(req,res)=>{
  userHelpers.doSignup(req.body).then((response)=>{
    req.session.loggedIn=true
    req.session.user=response
    res.redirect('/')
    
  })

})

router.post('/login',(req,res)=>{
  userHelpers.doLogin(req.body).then((response)=>{
    if(response.status){
      req.session.loggedIn=true
      req.session.user=response.user
      res.redirect('/')

    }else{
      req.session.loginErr='Invalid username or pasword'
      res.redirect('/login')
      
    }
  })
})

router.get('/logout',(req,res)=>{
  req.session.destroy()
  res.redirect('/')
})


router.get('/add-to-cart/:id',(req,res)=>{
  userHelpers.addToCart(req.params.id,req.session.user._id).then(()=>{
    //res.redirect('/')
    res.json({status:true})
  })
})

router.get('/cart',verifyLogin,async(req,res)=>{
  let products=await userHelpers.getCartProducts(req.session.user._id)
  let totalAmount=await userHelpers.getTotalAmount(req.session.user._id)
  if(products){
        res.render('user/cart',{products,user:req.session.user,totalAmount})
  }
})

router.post('/change-product-quantity/',(req,res,next)=>{

  userHelpers.changeProductQuantity(req.body).then(async(response)=>{
    response.total=await userHelpers.getTotalAmount(req.body.userId)
    res.json(response)
  })
})

router.get('/place-order',verifyLogin,async(req,res)=>{
  let total = await userHelpers.getTotalAmount(req.session.user._id)
  res.render('user/place-order',{user:req.session.user,total})
})

router.post('/check-out',async(req,res)=>{
  let products = await userHelpers.getAllProductsList(req.body.userId)
  let totalPrice = await userHelpers.getTotalAmount(req.body.userId)
  userHelpers.placeOrder(req.body,products,totalPrice).then((orderId)=>{
    if(req.body['payment-method']==='COD'){
      res.json({codSuccess:true})
    }else{
      userHelpers.generateRazorpay(orderId,totalPrice).then((response)=>{
        res.json(response)
      })
    }    
    
  })

})

router.get('/order-success',(req,res)=>{
  res.render('user/order-success',{user:req.session.user})
})

router.get('/all-orders',async(req,res)=>{
  let orders = await userHelpers.getUserOrders(req.session.user._id) 
  res.render('user/all-orders',{orders, user:req.session.user})
})

router.get('/view-order-products/:id',async(req,res)=>{
  let orderProducts = await userHelpers.getOrderProducts(req.params.id)
  res.render('user/view-order-products',{user:req.session.user,orderProducts})
})

router.post('/verify-payment',(req,res)=>{
  console.log(req.body)
  userHelpers.verifyPayment(req.body).then((response)=>{
    userHelpers.changePaymentStatus(req.body['order[receipt]']).then(()=>{
      res.json({status:true})
    }).catch((err)=>{
      res.json({status:false,errMsg:"Payment failed"})
    })
  })
})

router.post('/remove-product/',(req,res)=>{
  console.log(req.body.cartId,req.body.productId)
  userHelpers.removeCartProduct(req.body.cartId,req.body.productId).then((response)=>{
    res.json({success:true})
  })
  
})



module.exports = router;
